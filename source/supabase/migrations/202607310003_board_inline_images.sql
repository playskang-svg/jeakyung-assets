begin;

alter table public.board_posts
  add column content_document jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb;

update public.board_posts post set content_document=(
  select jsonb_build_object('type','doc','content',jsonb_agg(
    case when line.value='' then jsonb_build_object('type','paragraph')
      else jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',line.value))) end
    order by line.ordinality
  ))
  from regexp_split_to_table(post.content,E'\r?\n') with ordinality line(value,ordinality)
) where post.content<>'';

alter table public.board_attachments
  add column purpose text not null default 'general_attachment'
    check (purpose in ('inline_image','general_attachment')),
  add column lifecycle_status text not null default 'active'
    check (lifecycle_status in ('pending','active','cleanup_candidate','deleted')),
  add column alt_text text,
  add column caption text,
  add column alignment text check (alignment is null or alignment in ('left','center','right')),
  add column display_size text check (display_size is null or display_size in ('original','small','medium','large','custom')),
  add column display_width integer check (display_width is null or display_width between 80 and 2560),
  add column sort_order integer,
  add column image_width integer check (image_width is null or image_width > 0),
  add column image_height integer check (image_height is null or image_height > 0),
  add column image_format text check (image_format is null or image_format in ('jpeg','png','webp','gif')),
  add column cleanup_after timestamptz,
  add column removed_at timestamptz;

alter table public.board_attachments
  add constraint board_inline_image_metadata check (
    purpose <> 'inline_image' or (
      mime_type in ('image/jpeg','image/png','image/webp','image/gif')
      and file_size <= 10485760
      and image_width is not null
      and image_height is not null
      and image_format is not null
    )
  );

alter table public.board_posts
  add column cover_attachment_id uuid references public.board_attachments(id) on delete set null;

create index board_attachments_cleanup_idx
  on public.board_attachments(lifecycle_status, cleanup_after)
  where lifecycle_status = 'cleanup_candidate' and deleted_at is null;

create index board_attachments_inline_order_idx
  on public.board_attachments(post_id, sort_order)
  where purpose = 'inline_image' and deleted_at is null;

alter table public.boards alter column settings set default
  '{"show_in_sidebar":true,"allow_comments":true,"allow_replies":true,"allow_attachments":false,"allow_images":false,"allow_anonymous":false,"show_views":true,"allow_reactions":false,"show_post_number":true,"search_enabled":true,"page_size":20,"default_sort":"latest","max_file_size_mb":20,"max_inline_image_size_mb":10,"max_inline_images":20,"max_total_attachment_mb":50,"preserve_image_originals":false}'::jsonb;

update public.boards
set settings = '{"max_inline_image_size_mb":10,"max_inline_images":20,"max_total_attachment_mb":50,"preserve_image_originals":false}'::jsonb || settings;

create or replace function public.can_user_edit_board_post_for_attachment(p_post_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(
    select 1
    from public.board_posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and p.status <> 'deleted'
      and (
        (
          p.author_user_id = p_user_id
          and (
            public.evaluate_board_access(p.board_id, 'own_post_update', p_user_id)
            or (p.status = 'draft' and public.evaluate_board_access(p.board_id, 'post_create', p_user_id))
          )
        )
        or public.evaluate_board_access(p.board_id, 'other_post_update', p_user_id)
      )
  );
$$;

create or replace function public.can_edit_board_post_for_attachment(p_post_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid() is not null and public.can_user_edit_board_post_for_attachment(p_post_id,auth.uid());
$$;

create or replace function public.can_upload_board_attachment_path(p_storage_path text, p_metadata jsonb)
returns boolean language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  parts text[] := string_to_array(p_storage_path, '/');
  v_board_id uuid;
  v_post_id uuid;
  v_object_size bigint;
  v_object_mime text;
  v_settings jsonb;
  v_stored_inline_count integer;
  v_stored_total_bytes bigint;
begin
  if array_length(parts, 1) <> 5 or parts[2] <> auth.uid()::text or parts[3] not in ('inline','general') then return false; end if;
  begin v_board_id := parts[1]::uuid; exception when others then return false; end;
  if not public.evaluate_board_access(v_board_id, 'attachment_upload', auth.uid()) then return false; end if;
  begin v_post_id := parts[4]::uuid; exception when others then return false; end;
  v_object_size := coalesce((p_metadata->>'size')::bigint, 0);
  v_object_mime := coalesce(p_metadata->>'mimetype', '');
  select b.settings into v_settings from public.boards b where b.id=v_board_id;
  if not public.can_edit_board_post_for_attachment(v_post_id)
    or not exists(select 1 from public.board_posts p where p.id=v_post_id and p.board_id=v_board_id)
    or v_object_size < 1 then return false; end if;

  select
    count(*) filter (where split_part(o.name,'/',3)='inline'),
    coalesce(sum(coalesce((o.metadata->>'size')::bigint,0)),0)
  into v_stored_inline_count,v_stored_total_bytes
  from storage.objects o
  left join public.board_attachments a on a.storage_path=o.name and a.deleted_at is null
  where o.bucket_id='groupware-board-attachments'
    and split_part(o.name,'/',1)=v_board_id::text
    and split_part(o.name,'/',3) in ('inline','general')
    and split_part(o.name,'/',4)=v_post_id::text
    and (a.id is null or a.lifecycle_status in ('pending','active'));

  if parts[3]='inline' then
    return coalesce((v_settings->>'allow_images')::boolean,false)
      and v_object_size <= least(greatest(coalesce((v_settings->>'max_inline_image_size_mb')::bigint,10),1),10)*1048576
      and v_object_mime in ('image/jpeg','image/png','image/webp','image/gif')
      and v_stored_inline_count < least(greatest(coalesce((v_settings->>'max_inline_images')::integer,20),1),20)+1
      and v_stored_total_bytes+v_object_size <= (
        least(greatest(coalesce((v_settings->>'max_total_attachment_mb')::bigint,50),1),50)
        + least(greatest(coalesce((v_settings->>'max_inline_image_size_mb')::bigint,10),1),10)
      )*1048576;
  end if;
  return coalesce((v_settings->>'allow_attachments')::boolean,false)
    and v_object_size <= least(greatest(coalesce((v_settings->>'max_file_size_mb')::bigint,20),1),20)*1048576
    and v_stored_total_bytes+v_object_size <= least(greatest(coalesce((v_settings->>'max_total_attachment_mb')::bigint,50),1),50)*1048576
    and lower(parts[5]) !~ '\.(exe|dll|bat|cmd|com|scr|msi|js|jar|sh|ps1)$';
end;
$$;

create or replace function public.can_delete_unregistered_board_attachment_path(p_storage_path text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select (string_to_array(p_storage_path,'/'))[2]=auth.uid()::text
    and not exists(select 1 from public.board_attachments a where a.storage_path=p_storage_path);
$$;

create or replace function public.validate_board_document(p_document jsonb)
returns void language plpgsql stable set search_path = pg_catalog as $$
declare
  image_count integer;
  distinct_image_count integer;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' or p_document->>'type' <> 'doc' then
    raise exception 'invalid_board_document' using errcode='22023';
  end if;
  if pg_column_size(p_document) > 2097152 then
    raise exception 'board_document_too_large' using errcode='22023';
  end if;

  with recursive nodes(node) as (
    select p_document
    union all
    select child.value
    from nodes parent
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end
    ) child
  )
  select
    count(*) filter (where node->>'type'='inlineImage'),
    count(distinct node->'attrs'->>'attachmentId') filter (where node->>'type'='inlineImage')
  into image_count, distinct_image_count
  from nodes;

  if image_count > 20 then raise exception 'inline_image_limit_exceeded' using errcode='22023'; end if;
  if image_count <> distinct_image_count then raise exception 'duplicate_inline_attachment' using errcode='22023'; end if;

  if exists(
    with recursive nodes(node) as (
      select p_document
      union all
      select child.value from nodes parent
      cross join lateral jsonb_array_elements(case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end) child
    )
    select 1 from nodes
    where jsonb_typeof(node) <> 'object'
      or coalesce(node->>'type','') not in ('doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule','hardBreak','inlineImage')
      or (node ? 'content' and jsonb_typeof(node->'content') <> 'array')
      or (node ? 'attrs' and jsonb_typeof(node->'attrs') <> 'object')
      or (node ? 'marks' and jsonb_typeof(node->'marks') <> 'array')
      or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node)='object' then node else '{}'::jsonb end) key where key not in ('type','content','attrs','marks','text'))
      or (node->>'type'='text' and (not node ? 'text' or jsonb_typeof(node->'text') <> 'string'))
      or (node->>'type'<>'text' and node ? 'text')
      or (node->>'type'<>'text' and node ? 'marks')
      or (node->>'type'='doc' and node <> p_document)
      or (node->>'type'='heading' and (
        jsonb_typeof(node->'attrs'->'level')<>'number'
        or
        coalesce(node->'attrs'->>'level','') !~ '^[1-3]$'
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key<>'level')
      ))
      or (node->>'type'='orderedList' and (
        jsonb_typeof(node->'attrs'->'start')<>'number'
        or (node->'attrs' ? 'type' and node->'attrs'->'type'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'type')<>'string')
        or
        coalesce(node->'attrs'->>'start','') !~ '^[1-9][0-9]{0,5}$'
        or (node->'attrs' ? 'type' and node->'attrs'->>'type' is not null and node->'attrs'->>'type' not in ('1','a','A','i','I'))
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('start','type'))
      ))
      or (node->>'type'='codeBlock' and (
        (node->'attrs' ? 'language' and node->'attrs'->'language'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'language')<>'string')
        or
        (node->'attrs' ? 'language' and node->'attrs'->>'language' is not null and coalesce(node->'attrs'->>'language','') !~ '^[a-zA-Z0-9_+#.-]{1,40}$')
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key<>'language')
      ))
      or (node->>'type' not in ('heading','orderedList','codeBlock','inlineImage') and node ? 'attrs' and node->'attrs'<>'{}'::jsonb)
      or (node->>'type'='inlineImage' and (
        jsonb_typeof(node->'attrs'->'attachmentId')<>'string'
        or (node->'attrs' ? 'alt' and jsonb_typeof(node->'attrs'->'alt')<>'string')
        or (node->'attrs' ? 'caption' and jsonb_typeof(node->'attrs'->'caption')<>'string')
        or (node->'attrs' ? 'alignment' and jsonb_typeof(node->'attrs'->'alignment')<>'string')
        or (node->'attrs' ? 'size' and jsonb_typeof(node->'attrs'->'size')<>'string')
        or (node->'attrs' ? 'width' and node->'attrs'->'width'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'width')<>'number')
        or coalesce(node->'attrs'->>'attachmentId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or coalesce(node->'attrs'->>'alignment','center') not in ('left','center','right')
        or coalesce(node->'attrs'->>'size','medium') not in ('original','small','medium','large','custom')
        or (node->'attrs' ? 'width' and node->'attrs'->>'width' is not null and (
          case when node->'attrs'->>'width' ~ '^[0-9]{2,4}$' then (node->'attrs'->>'width')::integer not between 80 and 2560 else true end
        ))
        or char_length(coalesce(node->'attrs'->>'alt','')) > 500
        or char_length(coalesce(node->'attrs'->>'caption','')) > 1000
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('attachmentId','alt','caption','alignment','size','width'))
      ))
  ) then raise exception 'unsupported_board_document_node' using errcode='22023'; end if;

  if exists(
    with recursive nodes(node) as (
      select p_document
      union all
      select child.value from nodes parent
      cross join lateral jsonb_array_elements(case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end) child
    )
    select 1 from nodes n
    cross join lateral jsonb_array_elements(case when jsonb_typeof(n.node->'marks')='array' then n.node->'marks' else '[]'::jsonb end) mark(value)
    where jsonb_typeof(mark.value) <> 'object'
      or coalesce(mark.value->>'type','') not in ('bold','italic','strike','code')
      or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(mark.value)='object' then mark.value else '{}'::jsonb end) key where key not in ('type'))
  ) then raise exception 'unsupported_board_document_mark' using errcode='22023'; end if;
end;
$$;

create or replace function public.extract_board_document_text(p_document jsonb)
returns text language sql immutable set search_path = pg_catalog as $$
  with recursive nodes(node, sequence) as (
    select p_document, ''::text
    union all
    select child.value, nodes.sequence || lpad(child.ordinality::text, 6, '0')
    from nodes
    cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.node->'content')='array' then nodes.node->'content' else '[]'::jsonb end) with ordinality child(value, ordinality)
  )
  select left(coalesce(string_agg(node->>'text', ' ' order by sequence) filter (where node->>'type'='text'), ''), 200000)
  from nodes;
$$;

create or replace function public.reconcile_board_inline_images(p_post_id uuid, p_document jsonb, p_cover_attachment_id uuid default null)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  post_row public.board_posts;
  image_row record;
  image_ids uuid[] := '{}'::uuid[];
  resolved_cover uuid;
  settings jsonb;
begin
  select * into post_row from public.board_posts where id=p_post_id for update;
  if post_row.id is null or not public.can_edit_board_post_for_attachment(post_row.id) then
    raise exception 'post_update_denied' using errcode='42501';
  end if;
  perform public.validate_board_document(p_document);
  select b.settings into settings from public.boards b where b.id=post_row.board_id;

  for image_row in
    with recursive nodes(node, sequence) as (
      select p_document, ''::text
      union all
      select child.value, nodes.sequence || lpad(child.ordinality::text, 6, '0')
      from nodes
      cross join lateral jsonb_array_elements(case when jsonb_typeof(nodes.node->'content')='array' then nodes.node->'content' else '[]'::jsonb end) with ordinality child(value, ordinality)
    )
    select (node->'attrs'->>'attachmentId')::uuid attachment_id,
      coalesce(node->'attrs'->>'alt','') alt_text,
      nullif(btrim(coalesce(node->'attrs'->>'caption','')), '') caption,
      coalesce(node->'attrs'->>'alignment','center') alignment,
      coalesce(node->'attrs'->>'size','medium') display_size,
      nullif(node->'attrs'->>'width','')::integer display_width,
      row_number() over(order by sequence)::integer sort_order
    from nodes where node->>'type'='inlineImage'
    order by sequence
  loop
    if not exists(
      select 1 from public.board_attachments a
      where a.id=image_row.attachment_id and a.post_id=post_row.id and a.board_id=post_row.board_id
        and a.purpose='inline_image' and a.deleted_at is null and a.lifecycle_status in ('pending','active','cleanup_candidate')
    ) then raise exception 'invalid_inline_attachment_reference' using errcode='42501'; end if;
    image_ids := array_append(image_ids, image_row.attachment_id);
    update public.board_attachments set
      lifecycle_status='active', cleanup_after=null, removed_at=null,
      alt_text=image_row.alt_text, caption=image_row.caption, alignment=image_row.alignment,
      display_size=image_row.display_size, display_width=image_row.display_width, sort_order=image_row.sort_order
    where id=image_row.attachment_id;
  end loop;

  if coalesce(array_length(image_ids,1),0)>least(greatest(coalesce((settings->>'max_inline_images')::integer,20),1),20) then
    raise exception 'inline_image_count_exceeded' using errcode='22023';
  end if;
  if (select coalesce(sum(a.file_size),0) from public.board_attachments a where a.post_id=post_row.id and a.deleted_at is null and a.lifecycle_status<>'cleanup_candidate' and (a.purpose<>'inline_image' or a.id=any(image_ids)))
    > least(greatest(coalesce((settings->>'max_total_attachment_mb')::bigint,50),1),50)*1048576 then
    raise exception 'attachment_total_size_exceeded' using errcode='22023';
  end if;

  update public.board_attachments a set lifecycle_status='cleanup_candidate', cleanup_after=now()+interval '24 hours', removed_at=now()
  where a.post_id=post_row.id and a.purpose='inline_image' and a.deleted_at is null
    and a.lifecycle_status <> 'cleanup_candidate' and not (a.id=any(image_ids));

  if p_cover_attachment_id is not null then
    if not (p_cover_attachment_id=any(image_ids)) then raise exception 'invalid_gallery_cover' using errcode='42501'; end if;
    resolved_cover := p_cover_attachment_id;
  elsif exists(select 1 from public.boards b where b.id=post_row.board_id and b.board_type='gallery') and array_length(image_ids,1)>0 then
    resolved_cover := image_ids[1];
  else resolved_cover := null;
  end if;

  update public.board_posts set cover_attachment_id=resolved_cover,
    attachment_count=(select count(*) from public.board_attachments a where a.post_id=post_row.id and a.deleted_at is null and a.lifecycle_status='active')
  where id=post_row.id;
  return resolved_cover;
end;
$$;

create or replace function public.create_board_post_draft(p_board_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare result_id uuid;
begin
  if not public.can_access_board(p_board_id,'post_create') then raise exception 'post_create_denied' using errcode='42501'; end if;
  insert into public.board_posts(board_id,author_user_id,title,content,content_document,status)
  values(p_board_id,auth.uid(),'(제목 없음)','','{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,'draft')
  returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.register_inline_board_image(
  p_board_id uuid,p_post_id uuid,p_storage_path text,p_original_name text,p_mime_type text,p_file_size bigint,
  p_image_width integer,p_image_height integer,p_image_format text,p_uploader_id uuid,p_replaces_attachment_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  result_id uuid; post_row public.board_posts; settings jsonb; storage_row record;
  max_bytes bigint; max_images integer; max_total bigint; current_total bigint; expected_mime text;
begin
  select * into post_row from public.board_posts where id=p_post_id and board_id=p_board_id and deleted_at is null;
  if post_row.id is null or p_uploader_id is null or not public.evaluate_board_access(p_board_id,'attachment_upload',p_uploader_id) or not public.can_user_edit_board_post_for_attachment(p_post_id,p_uploader_id) then
    raise exception 'attachment_upload_denied' using errcode='42501';
  end if;
  select b.settings into settings from public.boards b where id=p_board_id;
  if not coalesce((settings->>'allow_images')::boolean,false) then raise exception 'images_disabled' using errcode='42501'; end if;
  if p_image_format not in ('jpeg','png','webp','gif') or p_image_width < 1 or p_image_height < 1
    or p_image_width::bigint*p_image_height::bigint > 40000000 then raise exception 'invalid_image_dimensions' using errcode='22023'; end if;
  expected_mime := case p_image_format when 'jpeg' then 'image/jpeg' when 'png' then 'image/png' when 'webp' then 'image/webp' when 'gif' then 'image/gif' end;
  if p_mime_type <> expected_mime then raise exception 'image_mime_mismatch' using errcode='22023'; end if;
  if lower(p_original_name) !~ '\.(jpe?g|png|webp|gif)$' then raise exception 'image_extension_not_allowed' using errcode='22023'; end if;
  if p_storage_path not like p_board_id::text||'/'||p_uploader_id::text||'/inline/'||p_post_id::text||'/%' then
    raise exception 'invalid_storage_path' using errcode='22023';
  end if;
  select o.owner_id,o.metadata into storage_row from storage.objects o
  where o.bucket_id='groupware-board-attachments' and o.name=p_storage_path;
  if storage_row.owner_id is null or storage_row.owner_id<>p_uploader_id::text then raise exception 'storage_object_not_owned' using errcode='42501'; end if;
  if coalesce((storage_row.metadata->>'size')::bigint,0)<>p_file_size or coalesce(storage_row.metadata->>'mimetype','')<>p_mime_type then
    raise exception 'storage_metadata_mismatch' using errcode='22023';
  end if;
  update public.board_attachments set lifecycle_status='cleanup_candidate',removed_at=coalesce(removed_at,now())
  where post_id=p_post_id and lifecycle_status='pending' and cleanup_after<=now() and deleted_at is null;
  max_bytes:=least(greatest(coalesce((settings->>'max_inline_image_size_mb')::bigint,10),1),10)*1048576;
  max_images:=least(greatest(coalesce((settings->>'max_inline_images')::integer,20),1),20);
  max_total:=least(greatest(coalesce((settings->>'max_total_attachment_mb')::bigint,50),1),50)*1048576;
  if p_file_size<1 or p_file_size>max_bytes then raise exception 'inline_image_size_exceeded' using errcode='22023'; end if;
  if p_replaces_attachment_id is not null and not exists(select 1 from public.board_attachments a where a.id=p_replaces_attachment_id and a.post_id=p_post_id and a.purpose='inline_image' and a.deleted_at is null and a.lifecycle_status in ('pending','active')) then
    raise exception 'invalid_replacement_attachment' using errcode='42501';
  end if;
  if (select count(*) from public.board_attachments a where a.post_id=p_post_id and a.purpose='inline_image' and a.deleted_at is null and a.lifecycle_status<>'cleanup_candidate')>=max_images then
    if p_replaces_attachment_id is null or not exists(select 1 from public.board_attachments a where a.id=p_replaces_attachment_id and a.post_id=p_post_id and a.purpose='inline_image' and a.deleted_at is null and a.lifecycle_status in ('pending','active')) then
      raise exception 'inline_image_count_exceeded' using errcode='22023';
    end if;
  end if;
  select coalesce(sum(a.file_size),0) into current_total from public.board_attachments a
  where a.post_id=p_post_id and a.deleted_at is null and a.lifecycle_status<>'cleanup_candidate'
    and (p_replaces_attachment_id is null or a.id<>p_replaces_attachment_id);
  if current_total+p_file_size>max_total then raise exception 'attachment_total_size_exceeded' using errcode='22023'; end if;
  insert into public.board_attachments(
    board_id,post_id,storage_path,original_name,mime_type,file_size,uploaded_by,purpose,lifecycle_status,
    image_width,image_height,image_format,alignment,display_size,cleanup_after
  ) values(
    p_board_id,p_post_id,p_storage_path,left(p_original_name,255),p_mime_type,p_file_size,p_uploader_id,'inline_image','pending',
    p_image_width,p_image_height,p_image_format,'center','medium',now()+interval '24 hours'
  ) returning id into result_id;
  return jsonb_build_object('id',result_id,'original_name',left(p_original_name,255),'mime_type',p_mime_type,'file_size',p_file_size,'image_width',p_image_width,'image_height',p_image_height,'purpose','inline_image');
end;
$$;

create or replace function public.register_board_attachment(p_board_id uuid,p_post_id uuid,p_storage_path text,p_original_name text,p_mime_type text,p_file_size bigint)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; post_row public.board_posts; settings jsonb; max_bytes bigint; max_total bigint; current_total bigint; storage_row record;
begin
  select * into post_row from public.board_posts where id=p_post_id and board_id=p_board_id and deleted_at is null;
  if post_row.id is null or not public.can_access_board(p_board_id,'attachment_upload') or not public.can_edit_board_post_for_attachment(p_post_id) then raise exception 'attachment_upload_denied' using errcode='42501'; end if;
  select b.settings into settings from public.boards b where id=p_board_id;
  if not coalesce((settings->>'allow_attachments')::boolean,false) then raise exception 'attachments_disabled' using errcode='42501'; end if;
  max_bytes:=least(greatest(coalesce((settings->>'max_file_size_mb')::bigint,20),1),20)*1048576;
  max_total:=least(greatest(coalesce((settings->>'max_total_attachment_mb')::bigint,50),1),50)*1048576;
  if p_file_size<1 or p_file_size>max_bytes then raise exception 'attachment_size_exceeded' using errcode='22023'; end if;
  if lower(p_original_name) ~ '\.(exe|dll|bat|cmd|com|scr|msi|js|jar|sh|ps1)$' then raise exception 'attachment_type_blocked' using errcode='22023'; end if;
  if p_storage_path not like p_board_id::text||'/'||auth.uid()::text||'/general/'||p_post_id::text||'/%' then raise exception 'invalid_storage_path' using errcode='22023'; end if;
  select o.owner_id,o.metadata into storage_row from storage.objects o where o.bucket_id='groupware-board-attachments' and o.name=p_storage_path;
  if storage_row.owner_id is null or storage_row.owner_id<>auth.uid()::text then raise exception 'storage_object_not_owned' using errcode='42501'; end if;
  if coalesce((storage_row.metadata->>'size')::bigint,0)<>p_file_size or coalesce(storage_row.metadata->>'mimetype','')<>p_mime_type then raise exception 'storage_metadata_mismatch' using errcode='22023'; end if;
  select coalesce(sum(a.file_size),0) into current_total from public.board_attachments a where a.post_id=p_post_id and a.deleted_at is null and a.lifecycle_status<>'cleanup_candidate';
  if current_total+p_file_size>max_total then raise exception 'attachment_total_size_exceeded' using errcode='22023'; end if;
  insert into public.board_attachments(board_id,post_id,storage_path,original_name,mime_type,file_size,uploaded_by,purpose,lifecycle_status)
  values(p_board_id,p_post_id,p_storage_path,left(p_original_name,255),p_mime_type,p_file_size,auth.uid(),'general_attachment','active') returning id into result_id;
  update public.board_posts set attachment_count=(select count(*) from public.board_attachments a where a.post_id=p_post_id and a.deleted_at is null and a.lifecycle_status='active') where id=p_post_id;
  return result_id;
end;
$$;

drop function public.save_board_post(uuid,uuid,text,text,uuid,text,boolean,boolean,boolean,boolean,text);
create function public.save_board_post(
  p_post_id uuid,p_board_id uuid,p_title text,p_content_document jsonb,p_category_id uuid,p_post_prefix text,
  p_is_anonymous boolean,p_is_notice boolean,p_is_important boolean,p_is_pinned boolean,p_status text default 'published',p_cover_attachment_id uuid default null
)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; existing public.board_posts; settings jsonb; before_data jsonb; after_data jsonb; clean_title text; plain_content text;
begin
  if p_status not in ('draft','published') then raise exception 'invalid_post_status' using errcode='22023'; end if;
  clean_title:=btrim(coalesce(p_title,''));
  if clean_title='' and p_status='published' then raise exception 'post_title_required' using errcode='22023'; end if;
  if clean_title='' then clean_title:='(제목 없음)'; end if;
  if char_length(clean_title)>240 then raise exception 'post_title_too_long' using errcode='22023'; end if;
  perform public.validate_board_document(p_content_document);
  plain_content:=public.extract_board_document_text(p_content_document);
  if p_status='published' and btrim(plain_content)='' and not exists(
    with recursive nodes(node) as (
      select p_content_document
      union all
      select child.value from nodes parent cross join lateral jsonb_array_elements(case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end) child
    ) select 1 from nodes where node->>'type'='inlineImage'
  ) then raise exception 'post_content_required' using errcode='22023'; end if;
  if p_post_id is null then
    if not public.can_access_board(p_board_id,'post_create') then raise exception 'post_create_denied' using errcode='42501'; end if;
    if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=p_board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
    select b.settings into settings from public.boards b where id=p_board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    if (p_is_notice or p_is_important) and not public.can_access_board(p_board_id,'notice_manage') then raise exception 'notice_manage_denied' using errcode='42501'; end if;
    if p_is_pinned and not public.can_access_board(p_board_id,'pin_manage') then raise exception 'pin_manage_denied' using errcode='42501'; end if;
    insert into public.board_posts(board_id,category_id,author_user_id,title,content,content_document,post_prefix,is_anonymous,is_notice,is_important,is_pinned,status,published_at)
    values(p_board_id,p_category_id,auth.uid(),clean_title,plain_content,p_content_document,nullif(btrim(p_post_prefix),''),coalesce(p_is_anonymous,false),coalesce(p_is_notice,false),coalesce(p_is_important,false),coalesce(p_is_pinned,false),p_status,case when p_status='published' then now() end) returning id into result_id;
  else
    select * into existing from public.board_posts where id=p_post_id for update;
    if existing.id is null or existing.board_id<>p_board_id or not public.can_edit_board_post_for_attachment(existing.id) then raise exception 'post_update_denied' using errcode='42501'; end if;
    if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=existing.board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
    select b.settings into settings from public.boards b where id=existing.board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    select to_jsonb(existing) into before_data;
    update public.board_posts set category_id=p_category_id,title=clean_title,content=plain_content,content_document=p_content_document,
      post_prefix=nullif(btrim(p_post_prefix),''),is_anonymous=coalesce(p_is_anonymous,false),
      is_notice=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_notice,false) else existing.is_notice end,
      is_important=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_important,false) else existing.is_important end,
      is_pinned=case when public.can_access_board(existing.board_id,'pin_manage') then coalesce(p_is_pinned,false) else existing.is_pinned end,
      status=p_status,published_at=case when p_status='published' then coalesce(existing.published_at,now()) else existing.published_at end,edited_at=now()
    where id=p_post_id returning id into result_id;
    if existing.author_user_id<>auth.uid() then
      select to_jsonb(p) into after_data from public.board_posts p where p.id=result_id;
      insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),'board.post.admin_updated','board_post',result_id::text,before_data,after_data);
    end if;
  end if;
  perform public.reconcile_board_inline_images(result_id,p_content_document,p_cover_attachment_id);
  return result_id;
end;
$$;

create or replace function public.get_board_posts(p_slug text,p_search text default null,p_category uuid default null,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare b public.boards; page_size integer; result jsonb;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then raise exception 'board_access_denied' using errcode='42501'; end if;
  page_size:=least(greatest(coalesce((b.settings->>'page_size')::integer,20),5),100);
  select jsonb_build_object('items',coalesce(jsonb_agg(item order by (item->>'is_pinned')::boolean desc,(item->>'created_at')::timestamptz desc),'[]'),'page',greatest(p_page,1),'page_size',page_size) into result from (
    select jsonb_build_object('id',p.id,'title',p.title,'prefix',p.post_prefix,'category',c.name,'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,'view_count',p.view_count,'comment_count',p.comment_count,'attachment_count',p.attachment_count,'created_at',p.created_at,'author_name',case when p.is_anonymous then '익명' else pr.name end,'cover_attachment_id',case when public.can_access_board(p.board_id,'attachment_view') then p.cover_attachment_id else null end) item
    from public.board_posts p left join public.profiles pr on pr.id=p.author_user_id left join public.board_categories c on c.id=p.category_id
    where p.board_id=b.id and p.status='published' and p.deleted_at is null and (p_category is null or p.category_id=p_category) and (coalesce(btrim(p_search),'')='' or p.title ilike '%'||p_search||'%' or p.content ilike '%'||p_search||'%')
    order by p.is_pinned desc,p.created_at desc limit page_size offset (greatest(p_page,1)-1)*page_size
  ) rows;
  return result;
end;
$$;

create or replace function public.get_board_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare p public.board_posts; author_name text; result jsonb;
begin
  select * into p from public.board_posts where id=p_post_id and status<>'deleted' and deleted_at is null;
  if p.id is null or not public.can_access_board(p.board_id,'detail_read') then raise exception 'post_access_denied' using errcode='42501'; end if;
  if p.status='draft' and p.author_user_id<>auth.uid() and not public.can_access_board(p.board_id,'other_post_update') then raise exception 'post_access_denied' using errcode='42501'; end if;
  insert into public.board_post_views(post_id,user_id,viewed_on) values(p.id,auth.uid(),current_date) on conflict do nothing;
  if found then update public.board_posts set view_count=view_count+1 where id=p.id; p.view_count:=p.view_count+1; end if;
  select case when p.is_anonymous then '익명' else name end into author_name from public.profiles where id=p.author_user_id;
  select jsonb_build_object(
    'post',jsonb_build_object('id',p.id,'board_id',p.board_id,'category_id',p.category_id,'title',p.title,'content',p.content,'content_document',p.content_document,'cover_attachment_id',p.cover_attachment_id,'prefix',p.post_prefix,'is_anonymous',p.is_anonymous,'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,'view_count',p.view_count,'created_at',p.created_at,'edited_at',p.edited_at,'author_name',author_name,'can_edit',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_update')) or public.can_access_board(p.board_id,'other_post_update'),'can_delete',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_delete')) or public.can_access_board(p.board_id,'other_post_delete')),
    'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'parent_comment_id',c.parent_comment_id,'content',case when c.deleted_at is null then c.content else '삭제된 댓글입니다.' end,'author_name',case when c.deleted_at is not null then '' when c.is_anonymous then '익명' else cp.name end,'created_at',c.created_at,'can_edit',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_update')) or public.can_access_board(c.board_id,'other_comment_update')),'can_delete',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_delete')) or public.can_access_board(c.board_id,'other_comment_delete'))) order by c.created_at) from public.board_comments c left join public.profiles cp on cp.id=c.author_user_id where c.post_id=p.id),'[]'),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'original_name',a.original_name,'mime_type',a.mime_type,'file_size',a.file_size,'purpose',a.purpose,'alt_text',a.alt_text,'caption',a.caption,'alignment',a.alignment,'display_size',a.display_size,'display_width',a.display_width,'sort_order',a.sort_order,'image_width',a.image_width,'image_height',a.image_height) order by coalesce(a.sort_order,2147483647),a.created_at) from public.board_attachments a where a.post_id=p.id and a.deleted_at is null and a.lifecycle_status='active' and public.can_access_board(a.board_id,'attachment_view')),'[]')
  ) into result;
  return result;
end;
$$;

create or replace function public.get_board_attachment_path(p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a public.board_attachments;
begin
  select * into a from public.board_attachments where id=p_attachment_id and deleted_at is null and lifecycle_status='active';
  if a.id is null or not exists(select 1 from public.board_posts p where p.id=a.post_id and p.deleted_at is null and p.status<>'deleted' and (p.status<>'draft' or p.author_user_id=auth.uid() or public.can_access_board(p.board_id,'other_post_update')))
    or not public.can_access_board(a.board_id,'detail_read') or not public.can_access_board(a.board_id,'attachment_view')
    or (a.purpose='general_attachment' and not public.can_access_board(a.board_id,'attachment_download')) then
    raise exception 'attachment_access_denied' using errcode='42501';
  end if;
  return jsonb_build_object('storage_path',a.storage_path,'original_name',a.original_name,'mime_type',a.mime_type,'purpose',a.purpose);
end;
$$;

create or replace function public.delete_board_post(p_post_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare post_row public.board_posts; before_data jsonb;
begin
  select * into post_row from public.board_posts where id=p_post_id for update;
  if post_row.id is null or not ((post_row.author_user_id=auth.uid() and public.can_access_board(post_row.board_id,'own_post_delete')) or public.can_access_board(post_row.board_id,'other_post_delete')) then raise exception 'post_delete_denied' using errcode='42501'; end if;
  select to_jsonb(post_row) into before_data;
  update public.board_posts set status='deleted',deleted_at=now(),cover_attachment_id=null where id=post_row.id;
  update public.board_attachments set lifecycle_status='cleanup_candidate',cleanup_after=now()+interval '24 hours',removed_at=now()
  where post_id=post_row.id and deleted_at is null and lifecycle_status<>'cleanup_candidate';
  if post_row.author_user_id<>auth.uid() then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),'board.post.admin_deleted','board_post',post_row.id::text,before_data,jsonb_build_object('status','deleted','deleted_at',now()));
  end if;
end;
$$;

create or replace function public.delete_board_attachment(p_attachment_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare attachment public.board_attachments;
begin
  select * into attachment from public.board_attachments where id=p_attachment_id and deleted_at is null for update;
  if attachment.id is null or not public.can_edit_board_post_for_attachment(attachment.post_id) then raise exception 'attachment_delete_denied' using errcode='42501'; end if;
  if attachment.purpose='inline_image' then
    update public.board_attachments set lifecycle_status='cleanup_candidate',cleanup_after=now()+interval '24 hours',removed_at=now() where id=attachment.id;
  else
    update public.board_attachments set lifecycle_status='cleanup_candidate',cleanup_after=now()+interval '24 hours',removed_at=now() where id=attachment.id;
  end if;
  update public.board_posts set cover_attachment_id=case when cover_attachment_id=attachment.id then null else cover_attachment_id end,
    attachment_count=(select count(*) from public.board_attachments a where a.post_id=attachment.post_id and a.deleted_at is null and a.lifecycle_status='active')
  where id=attachment.post_id;
end;
$$;

create or replace function public.can_read_board_attachment_path(p_storage_path text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(
    select 1 from public.board_attachments a join public.board_posts p on p.id=a.post_id
    where a.storage_path=p_storage_path and a.deleted_at is null and a.lifecycle_status='active' and p.deleted_at is null and p.status<>'deleted'
      and (p.status<>'draft' or p.author_user_id=auth.uid() or public.can_access_board(p.board_id,'other_post_update'))
      and public.can_access_board(a.board_id,'detail_read')
      and public.can_access_board(a.board_id,'attachment_view')
      and (a.purpose='inline_image' or public.can_access_board(a.board_id,'attachment_download'))
  );
$$;

update storage.buckets set public=false,file_size_limit=20971520,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
where id='groupware-board-attachments';

drop policy if exists storage_board_upload on storage.objects;
create policy storage_board_upload on storage.objects for insert to authenticated with check(
  bucket_id='groupware-board-attachments' and public.can_upload_board_attachment_path(name,metadata)
);

drop policy if exists storage_board_delete on storage.objects;
create policy storage_board_delete on storage.objects for delete to authenticated using(
  bucket_id='groupware-board-attachments' and public.can_delete_unregistered_board_attachment_path(name)
);

revoke all on function public.can_user_edit_board_post_for_attachment(uuid,uuid),public.can_edit_board_post_for_attachment(uuid),public.can_upload_board_attachment_path(text,jsonb),public.can_delete_unregistered_board_attachment_path(text),public.validate_board_document(jsonb),public.extract_board_document_text(jsonb),public.reconcile_board_inline_images(uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.create_board_post_draft(uuid),public.register_inline_board_image(uuid,uuid,text,text,text,bigint,integer,integer,text,uuid,uuid),public.save_board_post(uuid,uuid,text,jsonb,uuid,text,boolean,boolean,boolean,boolean,text,uuid) from public,anon;
grant execute on function public.create_board_post_draft(uuid),public.save_board_post(uuid,uuid,text,jsonb,uuid,text,boolean,boolean,boolean,boolean,text,uuid) to authenticated;
grant execute on function public.register_inline_board_image(uuid,uuid,text,text,text,bigint,integer,integer,text,uuid,uuid) to service_role;
grant execute on function public.can_upload_board_attachment_path(text,jsonb) to authenticated;
grant execute on function public.can_delete_unregistered_board_attachment_path(text) to authenticated;

commit;
