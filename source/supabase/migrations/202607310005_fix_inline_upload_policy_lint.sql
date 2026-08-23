begin;

create or replace function public.can_upload_board_attachment_path(p_storage_path text, p_metadata jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
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

alter function public.validate_board_document(jsonb) stable;

create or replace function public.manage_board(p_board jsonb,p_rules jsonb,p_categories jsonb,p_managers jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; before_data jsonb; after_data jsonb; item jsonb;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  result_id:=nullif(p_board->>'id','')::uuid;
  if result_id is null then
    insert into public.boards(group_id,name,slug,description,board_type,settings,sort_order,is_active,created_by) values(nullif(p_board->>'group_id','')::uuid,p_board->>'name',p_board->>'slug',p_board->>'description',coalesce(p_board->>'board_type','general'),coalesce(p_board->'settings','{}'),coalesce((p_board->>'sort_order')::integer,0),coalesce((p_board->>'is_active')::boolean,true),auth.uid()) returning id into result_id;
  else
    select to_jsonb(b) into before_data from public.boards b where id=result_id for update;
    if before_data is null then raise exception 'board_not_found'; end if;
    if not public.has_role('super_admin') and not exists(select 1 from public.board_managers where board_id=result_id and user_id=auth.uid()) and not public.can_access_board(result_id,'board_setting_manage') then raise exception 'board_manage_denied' using errcode='42501'; end if;
    update public.boards set group_id=nullif(p_board->>'group_id','')::uuid,name=p_board->>'name',slug=p_board->>'slug',description=p_board->>'description',board_type=coalesce(p_board->>'board_type','general'),settings=coalesce(p_board->'settings','{}'),sort_order=coalesce((p_board->>'sort_order')::integer,0),is_active=coalesce((p_board->>'is_active')::boolean,true),archived_at=case when coalesce((p_board->>'archived')::boolean,false) then now() else null end where id=result_id;
  end if;
  delete from public.board_permission_rules where board_id=result_id;
  for item in select value from jsonb_array_elements(coalesce(p_rules,'[]')) loop insert into public.board_permission_rules(board_id,action,target_type,target_id,effect,created_by) values(result_id,item->>'action',item->>'target_type',nullif(item->>'target_id',''),item->>'effect',auth.uid()); end loop;
  delete from public.board_categories where board_id=result_id;
  for item in select value from jsonb_array_elements(coalesce(p_categories,'[]')) loop insert into public.board_categories(board_id,name,code,sort_order,is_active) values(result_id,item->>'name',item->>'code',coalesce((item->>'sort_order')::integer,0),true); end loop;
  if public.has_role('super_admin') or public.can_access_board(result_id,'permission_manage') or before_data is null then
    delete from public.board_managers where board_id=result_id;
    for item in select value from jsonb_array_elements(coalesce(p_managers,'[]')) loop
      insert into public.board_managers(board_id,user_id,assigned_by) values(result_id,(item#>>'{}')::uuid,auth.uid());
    end loop;
  else
    raise exception 'permission_manage_denied' using errcode='42501';
  end if;
  select to_jsonb(b) into after_data from public.boards b where id=result_id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),case when before_data is null then 'board.created' when (after_data->>'archived_at') is not null then 'board.archived' else 'board.updated' end,'board',result_id::text,before_data,after_data);
  return result_id;
end;
$$;

commit;
