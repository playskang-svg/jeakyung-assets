begin;

-- 운영 게시판 유형: 기존 유형은 보존하고 댓글 중심 유형을 추가한다.
alter table public.boards drop constraint if exists boards_board_type_check;
alter table public.boards add constraint boards_board_type_check check (
  board_type in ('general','notice','files','anonymous','qna','gallery','project','department','free','custom','discussion')
);

-- 사용자 게시판 목록은 Sidebar 표시와 실제 목록 읽기 권한을 모두 통과해야 한다.
create or replace function public.get_my_visible_boards()
returns table(id uuid,group_id uuid,group_name text,name text,slug text,description text,board_type text,settings jsonb,sort_order integer,is_favorite boolean,last_visited_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $$
  select b.id,b.group_id,g.name,b.name,b.slug,b.description,b.board_type,b.settings,b.sort_order,
    exists(select 1 from public.board_favorites f where f.board_id=b.id and f.user_id=auth.uid()),
    (select v.visited_at from public.board_recent_visits v where v.board_id=b.id and v.user_id=auth.uid())
  from public.boards b
  left join public.board_groups g on g.id=b.group_id
  where b.is_active
    and b.archived_at is null
    and coalesce((b.settings->>'show_in_sidebar')::boolean,true)
    and public.can_access_board(b.id,'sidebar_view')
    and public.can_access_board(b.id,'list_read')
  order by g.sort_order,b.sort_order,b.name;
$$;

create or replace function public.get_board_overview(p_slug text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare b public.boards; result jsonb;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then
    raise exception 'board_access_denied' using errcode='42501';
  end if;
  insert into public.board_recent_visits(board_id,user_id,visited_at)
  values(b.id,auth.uid(),now())
  on conflict(board_id,user_id) do update set visited_at=excluded.visited_at;
  select jsonb_build_object(
    'board',jsonb_build_object(
      'id',b.id,'name',b.name,'slug',b.slug,'description',b.description,
      'board_type',b.board_type,'settings',b.settings
    ),
    'permissions',jsonb_build_object(
      'read',public.can_access_board(b.id,'detail_read'),
      'create',public.can_access_board(b.id,'post_create'),
      'comment',public.can_access_board(b.id,'comment_create'),
      'upload',public.can_access_board(b.id,'attachment_upload'),
      'notice',public.can_access_board(b.id,'notice_manage'),
      'pin',public.can_access_board(b.id,'pin_manage')
    ),
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',c.code) order by c.sort_order,c.name)
      from public.board_categories c where c.board_id=b.id and c.is_active
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- 댓글형은 최근 댓글 활동순, 그 외 유형은 설정된 기본 정렬을 적용한다.
create or replace function public.get_board_posts(p_slug text,p_search text default null,p_category uuid default null,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare b public.boards; page_size integer; result jsonb; effective_search text;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then
    raise exception 'board_access_denied' using errcode='42501';
  end if;
  page_size:=least(greatest(coalesce((b.settings->>'page_size')::integer,20),5),100);
  effective_search:=case when coalesce((b.settings->>'search_enabled')::boolean,true) then nullif(btrim(p_search),'') else null end;

  select jsonb_build_object(
    'items',coalesce(jsonb_agg(item order by is_pinned desc,discussion_activity desc nulls last,popularity desc nulls last,oldest_date asc nulls last,created_at desc),'[]'::jsonb),
    'page',greatest(p_page,1),
    'page_size',page_size,
    'total_count',(select count(*) from public.board_posts total
      where total.board_id=b.id and total.status='published' and total.deleted_at is null
        and (p_category is null or total.category_id=p_category)
        and (effective_search is null or total.title ilike '%'||effective_search||'%' or total.content ilike '%'||effective_search||'%'))
  ) into result
  from (
    select
      jsonb_build_object(
        'id',p.id,'title',p.title,'prefix',p.post_prefix,'category',c.name,
        'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,
        'view_count',p.view_count,'comment_count',p.comment_count,'attachment_count',p.attachment_count,
        'created_at',p.created_at,'last_activity_at',coalesce(last_comment.created_at,p.created_at),
        'excerpt',left(regexp_replace(coalesce(p.content,''),'[[:space:]]+',' ','g'),180),
        'author_name',case when p.is_anonymous then '익명' else pr.name end,
        'author_department',case when p.is_anonymous then null else department.name end,
        'author_position',case when p.is_anonymous then null else position_row.name end,
        'author_job_title',case when p.is_anonymous then null else job_title.name end,
        'cover_attachment_id',case when public.can_access_board(p.board_id,'attachment_view') then p.cover_attachment_id else null end
      ) item,
      p.is_pinned,
      case when b.board_type='discussion' then coalesce(last_comment.created_at,p.created_at) end discussion_activity,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='popular' then p.view_count+(p.comment_count*3) end popularity,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='oldest' then p.created_at end oldest_date,
      p.created_at
    from public.board_posts p
    left join public.profiles pr on pr.id=p.author_user_id
    left join public.departments department on department.id=pr.department_id
    left join public.positions position_row on position_row.id=pr.position_id
    left join public.job_titles job_title on job_title.id=pr.job_title_id
    left join public.board_categories c on c.id=p.category_id
    left join lateral (
      select max(comment.created_at) created_at
      from public.board_comments comment
      where comment.post_id=p.id and comment.deleted_at is null
    ) last_comment on true
    where p.board_id=b.id and p.status='published' and p.deleted_at is null
      and (p_category is null or p.category_id=p_category)
      and (effective_search is null or p.title ilike '%'||effective_search||'%' or p.content ilike '%'||effective_search||'%')
    order by
      p.is_pinned desc,
      case when b.board_type='discussion' then coalesce(last_comment.created_at,p.created_at) end desc nulls last,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='popular' then p.view_count+(p.comment_count*3) end desc nulls last,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='oldest' then p.created_at end asc nulls last,
      p.created_at desc
    limit page_size offset (greatest(p_page,1)-1)*page_size
  ) rows;
  return result;
end;
$$;

create or replace function public.get_board_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  p public.board_posts;
  author_name text;
  author_department text;
  author_position text;
  author_job_title text;
  result jsonb;
begin
  select * into p from public.board_posts where id=p_post_id and status<>'deleted' and deleted_at is null;
  if p.id is null or not public.can_access_board(p.board_id,'detail_read') then raise exception 'post_access_denied' using errcode='42501'; end if;
  if p.status='draft' and p.author_user_id<>auth.uid() and not public.can_access_board(p.board_id,'other_post_update') then raise exception 'post_access_denied' using errcode='42501'; end if;
  insert into public.board_post_views(post_id,user_id,viewed_on) values(p.id,auth.uid(),current_date) on conflict do nothing;
  if found then update public.board_posts set view_count=view_count+1 where id=p.id; p.view_count:=p.view_count+1; end if;
  select
    case when p.is_anonymous then '익명' else profile.name end,
    case when p.is_anonymous then null else department.name end,
    case when p.is_anonymous then null else position_row.name end,
    case when p.is_anonymous then null else job_title.name end
  into author_name,author_department,author_position,author_job_title
  from public.profiles profile
  left join public.departments department on department.id=profile.department_id
  left join public.positions position_row on position_row.id=profile.position_id
  left join public.job_titles job_title on job_title.id=profile.job_title_id
  where profile.id=p.author_user_id;
  select jsonb_build_object(
    'post',jsonb_build_object(
      'id',p.id,'board_id',p.board_id,'category_id',p.category_id,'title',p.title,'content',p.content,
      'content_document',p.content_document,'cover_attachment_id',p.cover_attachment_id,'prefix',p.post_prefix,
      'is_anonymous',p.is_anonymous,'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,
      'view_count',p.view_count,'created_at',p.created_at,'edited_at',p.edited_at,'author_name',author_name,
      'author_department',author_department,'author_position',author_position,'author_job_title',author_job_title,
      'can_edit',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_update')) or public.can_access_board(p.board_id,'other_post_update'),
      'can_delete',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_delete')) or public.can_access_board(p.board_id,'other_post_delete')
    ),
    'comments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'parent_comment_id',c.parent_comment_id,'content',case when c.deleted_at is null then c.content else '삭제된 댓글입니다.' end,
      'author_name',case when c.deleted_at is not null then '' when c.is_anonymous then '익명' else cp.name end,'created_at',c.created_at,
      'can_edit',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_update')) or public.can_access_board(c.board_id,'other_comment_update')),
      'can_delete',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_delete')) or public.can_access_board(c.board_id,'other_comment_delete'))
    ) order by c.created_at) from public.board_comments c left join public.profiles cp on cp.id=c.author_user_id where c.post_id=p.id),'[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'original_name',a.original_name,'mime_type',a.mime_type,'file_size',a.file_size,'purpose',a.purpose,
      'alt_text',a.alt_text,'caption',a.caption,'alignment',a.alignment,'display_size',a.display_size,
      'display_width',a.display_width,'sort_order',a.sort_order,'image_width',a.image_width,'image_height',a.image_height
    ) order by coalesce(a.sort_order,2147483647),a.created_at) from public.board_attachments a
      where a.post_id=p.id and a.deleted_at is null and a.lifecycle_status='active' and public.can_access_board(a.board_id,'attachment_view')),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- 게시판 생성·수정과 권한 교체를 한 트랜잭션에서 검증한다.
create or replace function public.manage_board(p_board jsonb,p_rules jsonb,p_categories jsonb,p_managers jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare
  result_id uuid;
  before_data jsonb;
  after_data jsonb;
  item jsonb;
  board_kind text;
  board_settings jsonb;
  category_id uuid;
  submitted_category_ids uuid[] := '{}'::uuid[];
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_rules,'[]'::jsonb)) <> 'array' then
    raise exception 'invalid_board_rules' using errcode='22023';
  end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb)) rule where rule->>'action'='sidebar_view' and rule->>'effect'='allow')
    or not exists(select 1 from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb)) rule where rule->>'action'='list_read' and rule->>'effect'='allow')
    or not exists(select 1 from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb)) rule where rule->>'action'='detail_read' and rule->>'effect'='allow') then
    raise exception 'board_read_permission_required' using errcode='22023';
  end if;

  board_kind:=coalesce(nullif(p_board->>'board_type',''),'free');
  if board_kind not in ('general','notice','files','anonymous','qna','gallery','project','department','free','custom','discussion') then
    raise exception 'invalid_board_type' using errcode='22023';
  end if;
  board_settings:='{"show_in_sidebar":true,"allow_comments":true,"allow_replies":true,"allow_attachments":true,"allow_images":true,"allow_anonymous":false,"allow_reactions":true,"allow_notices":true,"allow_important":true,"show_views":true,"show_author_department":true,"show_author_position":false,"show_author_job_title":true,"show_post_number":true,"search_enabled":true,"use_prefix":false,"use_pinned":true,"page_size":20,"default_sort":"latest","max_file_size_mb":20,"max_inline_image_size_mb":10,"max_inline_images":20,"max_total_attachment_mb":50,"preserve_image_originals":false}'::jsonb
    || coalesce(p_board->'settings','{}'::jsonb);
  if board_kind='gallery' then
    board_settings:=board_settings||'{"allow_images":true}'::jsonb;
  elsif board_kind='discussion' then
    board_settings:=board_settings||'{"allow_comments":true,"allow_replies":true,"allow_reactions":true,"default_sort":"activity"}'::jsonb;
  end if;

  result_id:=nullif(p_board->>'id','')::uuid;
  if result_id is null then
    insert into public.boards(group_id,name,slug,description,board_type,settings,sort_order,is_active,created_by)
    values(nullif(p_board->>'group_id','')::uuid,btrim(p_board->>'name'),lower(btrim(p_board->>'slug')),nullif(btrim(p_board->>'description'),''),board_kind,board_settings,coalesce((p_board->>'sort_order')::integer,0),coalesce((p_board->>'is_active')::boolean,true),auth.uid())
    returning id into result_id;
  else
    select to_jsonb(b) into before_data from public.boards b where id=result_id for update;
    if before_data is null then raise exception 'board_not_found'; end if;
    if not public.has_role('super_admin')
      and not exists(select 1 from public.board_managers where board_id=result_id and user_id=auth.uid())
      and not public.can_access_board(result_id,'board_setting_manage') then
      raise exception 'board_manage_denied' using errcode='42501';
    end if;
    update public.boards set
      group_id=nullif(p_board->>'group_id','')::uuid,
      name=btrim(p_board->>'name'),
      slug=lower(btrim(p_board->>'slug')),
      description=nullif(btrim(p_board->>'description'),''),
      board_type=board_kind,
      settings=board_settings,
      sort_order=coalesce((p_board->>'sort_order')::integer,0),
      is_active=coalesce((p_board->>'is_active')::boolean,true),
      archived_at=case when coalesce((p_board->>'archived')::boolean,false) then coalesce(archived_at,now()) else null end
    where id=result_id;
  end if;

  delete from public.board_permission_rules where board_id=result_id;
  for item in select value from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb)) loop
    insert into public.board_permission_rules(board_id,action,target_type,target_id,effect,created_by)
    values(result_id,item->>'action',item->>'target_type',nullif(item->>'target_id',''),item->>'effect',auth.uid());
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_categories,'[]'::jsonb)) loop
    category_id:=nullif(item->>'id','')::uuid;
    if category_id is not null and exists(select 1 from public.board_categories category where category.id=category_id and category.board_id=result_id) then
      update public.board_categories set
        name=btrim(item->>'name'),
        code=lower(btrim(item->>'code')),
        sort_order=coalesce((item->>'sort_order')::integer,0),
        is_active=coalesce((item->>'is_active')::boolean,true)
      where id=category_id;
    else
      insert into public.board_categories(board_id,name,code,sort_order,is_active)
      values(result_id,btrim(item->>'name'),lower(btrim(item->>'code')),coalesce((item->>'sort_order')::integer,0),coalesce((item->>'is_active')::boolean,true))
      returning id into category_id;
    end if;
    submitted_category_ids:=array_append(submitted_category_ids,category_id);
  end loop;
  update public.board_categories set is_active=false
  where board_id=result_id and not (id=any(submitted_category_ids));

  if public.has_role('super_admin') or public.can_access_board(result_id,'permission_manage') or before_data is null then
    delete from public.board_managers where board_id=result_id;
    for item in select value from jsonb_array_elements(coalesce(p_managers,'[]'::jsonb)) loop
      insert into public.board_managers(board_id,user_id,assigned_by)
      values(result_id,(item#>>'{}')::uuid,auth.uid());
    end loop;
  else
    raise exception 'permission_manage_denied' using errcode='42501';
  end if;

  select to_jsonb(b) into after_data from public.boards b where id=result_id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data)
  values(auth.uid(),case when before_data is null then 'board.created' when (after_data->>'archived_at') is not null then 'board.archived' else 'board.updated' end,'board',result_id::text,before_data,after_data);
  return result_id;
end;
$$;

create or replace function public.enforce_board_post_feature_settings()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare feature_settings jsonb;
begin
  select board.settings into feature_settings from public.boards board where board.id=new.board_id;
  if new.is_notice and not coalesce((feature_settings->>'allow_notices')::boolean,true) then
    raise exception 'notices_disabled' using errcode='42501';
  end if;
  if new.is_important and not coalesce((feature_settings->>'allow_important')::boolean,true) then
    raise exception 'important_posts_disabled' using errcode='42501';
  end if;
  if new.is_pinned and not coalesce((feature_settings->>'use_pinned')::boolean,true) then
    raise exception 'pinned_posts_disabled' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists board_posts_enforce_feature_settings on public.board_posts;
create trigger board_posts_enforce_feature_settings
before insert or update of is_notice,is_important,is_pinned,board_id on public.board_posts
for each row execute function public.enforce_board_post_feature_settings();

revoke all on function public.get_my_visible_boards(),public.get_board_overview(text),public.get_board_posts(text,text,uuid,integer),public.manage_board(jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.get_my_visible_boards(),public.get_board_overview(text),public.get_board_posts(text,text,uuid,integer),public.manage_board(jsonb,jsonb,jsonb,jsonb) to authenticated;
revoke all on function public.enforce_board_post_feature_settings() from public,anon,authenticated;

commit;
