begin;

create or replace function public.board_target_matches(p_board_id uuid, p_target_type text, p_target_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select case p_target_type
    when 'all' then true
    when 'user' then p_target_id=p_user_id::text
    when 'role' then exists(select 1 from public.user_role_assignments where user_id=p_user_id and role_code=p_target_id)
    when 'department' then exists(select 1 from public.profiles where id=p_user_id and department_id::text=p_target_id)
    when 'position' then exists(select 1 from public.profiles where id=p_user_id and position_id::text=p_target_id)
    when 'job_title' then exists(select 1 from public.profiles where id=p_user_id and job_title_id::text=p_target_id)
    when 'board_manager' then exists(select 1 from public.board_managers where board_id=p_board_id and user_id=p_user_id)
    when 'author' then true
    else false end;
$$;

revoke all on function public.board_target_matches(uuid,text,text,uuid) from public,anon,authenticated;

alter table public.board_permission_rules
  add constraint board_permission_author_action
  check (target_type <> 'author' or action in ('own_post_update','own_post_delete','own_comment_update','own_comment_delete'));

create or replace function public.set_my_dashboard_preference(p_widget_id uuid, p_custom_order integer, p_is_hidden boolean)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare w public.dashboard_widgets;
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  select * into w from public.dashboard_widgets where id=p_widget_id and is_active and archived_at is null;
  if w.id is null then raise exception 'widget_not_found'; end if;
  if not exists(select 1 from public.dashboard_widget_assignments a where a.widget_id=w.id and a.effect='allow' and public.dashboard_target_matches(a.target_type,a.target_id,auth.uid())) or exists(select 1 from public.dashboard_widget_assignments a where a.widget_id=w.id and a.effect='deny' and public.dashboard_target_matches(a.target_type,a.target_id,auth.uid())) then raise exception 'widget_not_assigned' using errcode='42501'; end if;
  if p_is_hidden and (w.is_required or not w.allow_user_hide) then raise exception 'widget_cannot_be_hidden' using errcode='42501'; end if;
  if p_custom_order is not null and not w.allow_user_reorder then raise exception 'widget_cannot_be_reordered' using errcode='42501'; end if;
  insert into public.user_dashboard_preferences(user_id,widget_id,custom_order,is_hidden,updated_at)
  values(auth.uid(),p_widget_id,p_custom_order,coalesce(p_is_hidden,false),now())
  on conflict(user_id,widget_id) do update set custom_order=excluded.custom_order,is_hidden=excluded.is_hidden,updated_at=now();
end; $$;

create or replace function public.get_board_overview(p_slug text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare b public.boards; result jsonb;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then raise exception 'board_access_denied' using errcode='42501'; end if;
  insert into public.board_recent_visits(board_id,user_id,visited_at) values(b.id,auth.uid(),now()) on conflict(board_id,user_id) do update set visited_at=excluded.visited_at;
  select jsonb_build_object('board',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'board_type',b.board_type,'settings',b.settings),'permissions',jsonb_build_object('create',public.can_access_board(b.id,'post_create'),'comment',public.can_access_board(b.id,'comment_create'),'upload',public.can_access_board(b.id,'attachment_upload'),'notice',public.can_access_board(b.id,'notice_manage'),'pin',public.can_access_board(b.id,'pin_manage')),'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',c.code) order by c.sort_order,c.name) from public.board_categories c where c.board_id=b.id and c.is_active),'[]')) into result;
  return result;
end; $$;

drop function public.save_board_post(uuid,uuid,text,text,uuid,boolean,boolean,text);
create function public.save_board_post(p_post_id uuid,p_board_id uuid,p_title text,p_content text,p_category_id uuid,p_post_prefix text,p_is_anonymous boolean,p_is_notice boolean,p_is_important boolean,p_is_pinned boolean,p_status text default 'published')
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; existing public.board_posts; settings jsonb; before_data jsonb; after_data jsonb;
begin
  if p_post_id is null then
    if not public.can_access_board(p_board_id,'post_create') then raise exception 'post_create_denied' using errcode='42501'; end if;
    if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=p_board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
    select b.settings into settings from public.boards b where id=p_board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    if (p_is_notice or p_is_important) and not public.can_access_board(p_board_id,'notice_manage') then raise exception 'notice_manage_denied' using errcode='42501'; end if;
    if p_is_pinned and not public.can_access_board(p_board_id,'pin_manage') then raise exception 'pin_manage_denied' using errcode='42501'; end if;
    insert into public.board_posts(board_id,category_id,author_user_id,title,content,post_prefix,is_anonymous,is_notice,is_important,is_pinned,status,published_at)
    values(p_board_id,p_category_id,auth.uid(),btrim(p_title),coalesce(p_content,''),nullif(btrim(p_post_prefix),''),coalesce(p_is_anonymous,false),coalesce(p_is_notice,false),coalesce(p_is_important,false),coalesce(p_is_pinned,false),coalesce(p_status,'published'),case when p_status='published' then now() end) returning id into result_id;
  else
    select * into existing from public.board_posts where id=p_post_id for update;
    if existing.id is null or not ((existing.author_user_id=auth.uid() and public.can_access_board(existing.board_id,'own_post_update')) or public.can_access_board(existing.board_id,'other_post_update')) then raise exception 'post_update_denied' using errcode='42501'; end if;
    if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=existing.board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
    select b.settings into settings from public.boards b where id=existing.board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    select to_jsonb(existing) into before_data;
    update public.board_posts set category_id=p_category_id,title=btrim(p_title),content=coalesce(p_content,''),post_prefix=nullif(btrim(p_post_prefix),''),is_anonymous=coalesce(p_is_anonymous,false),is_notice=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_notice,false) else existing.is_notice end,is_important=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_important,false) else existing.is_important end,is_pinned=case when public.can_access_board(existing.board_id,'pin_manage') then coalesce(p_is_pinned,false) else existing.is_pinned end,status=coalesce(p_status,existing.status),published_at=case when p_status='published' then coalesce(existing.published_at,now()) else existing.published_at end,edited_at=now() where id=p_post_id returning id into result_id;
    if existing.author_user_id<>auth.uid() then select to_jsonb(p) into after_data from public.board_posts p where p.id=result_id; insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),'board.post.admin_updated','board_post',result_id::text,before_data,after_data); end if;
  end if;
  return result_id;
end; $$;

create or replace function public.delete_board_post(p_post_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare p public.board_posts; before_data jsonb;
begin
  select * into p from public.board_posts where id=p_post_id for update;
  if p.id is null or not ((p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_delete')) or public.can_access_board(p.board_id,'other_post_delete')) then raise exception 'post_delete_denied' using errcode='42501'; end if;
  select to_jsonb(p) into before_data;
  update public.board_posts set status='deleted',deleted_at=now() where id=p.id;
  if p.author_user_id<>auth.uid() then insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),'board.post.admin_deleted','board_post',p.id::text,before_data,jsonb_build_object('status','deleted','deleted_at',now())); end if;
end; $$;

revoke all on function public.save_board_post(uuid,uuid,text,text,uuid,text,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.save_board_post(uuid,uuid,text,text,uuid,text,boolean,boolean,boolean,boolean,text) to authenticated;

commit;
