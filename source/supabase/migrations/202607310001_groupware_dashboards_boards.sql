begin;

create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  widget_type text not null check (widget_type in ('notices','approval_status','today_schedule','week_schedule','recent_posts','mail_link','quick_links','emergency_alert','custom_link','custom_notice')),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  route text,
  configuration jsonb not null default '{}'::jsonb,
  size text not null default 'medium' check (size in ('small','medium','large','full')),
  sort_order integer not null default 0,
  is_required boolean not null default false,
  allow_user_hide boolean not null default true,
  allow_user_reorder boolean not null default true,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dashboard_widget_assignments (
  id uuid primary key default gen_random_uuid(),
  widget_id uuid not null references public.dashboard_widgets(id) on delete cascade,
  target_type text not null check (target_type in ('all','role','department','position','job_title','user')),
  target_id text,
  effect text not null check (effect in ('allow','deny')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dashboard_assignment_target check ((target_type = 'all' and target_id is null) or (target_type <> 'all' and target_id is not null))
);

create table public.user_dashboard_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  widget_id uuid not null references public.dashboard_widgets(id) on delete cascade,
  custom_order integer,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, widget_id)
);

create table public.board_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,59}$'),
  description text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.board_groups(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  description text,
  board_type text not null default 'general' check (board_type in ('general','notice','files','anonymous','qna','gallery','project','department','free','custom')),
  settings jsonb not null default '{"show_in_sidebar":true,"allow_comments":true,"allow_replies":true,"allow_attachments":false,"allow_images":false,"allow_anonymous":false,"show_views":true,"allow_reactions":false,"show_post_number":true,"search_enabled":true,"page_size":20,"default_sort":"latest","max_file_size_mb":20}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_categories (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  code text not null check (code ~ '^[a-z0-9][a-z0-9_-]{1,59}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, code)
);

create table public.board_permission_rules (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  action text not null check (action in ('sidebar_view','list_read','detail_read','post_create','own_post_update','own_post_delete','other_post_update','other_post_delete','comment_create','own_comment_update','own_comment_delete','other_comment_update','other_comment_delete','attachment_view','attachment_download','attachment_upload','notice_manage','pin_manage','category_manage','permission_manage','board_setting_manage','archive_manage','board_delete')),
  target_type text not null check (target_type in ('all','role','department','position','job_title','user','board_manager','author')),
  target_id text,
  effect text not null check (effect in ('allow','deny')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_permission_target check ((target_type in ('all','board_manager','author') and target_id is null) or (target_type not in ('all','board_manager','author') and target_id is not null))
);

create table public.board_managers (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.board_favorites (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.board_recent_visits (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  category_id uuid references public.board_categories(id) on delete set null,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 240),
  content text not null default '',
  post_prefix text,
  is_anonymous boolean not null default false,
  is_notice boolean not null default false,
  is_important boolean not null default false,
  is_pinned boolean not null default false,
  view_count bigint not null default 0,
  comment_count integer not null default 0,
  attachment_count integer not null default 0,
  status text not null default 'published' check (status in ('draft','published','hidden','deleted')),
  published_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  post_id uuid not null references public.board_posts(id) on delete cascade,
  parent_comment_id uuid references public.board_comments(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  content text not null check (char_length(content) between 1 and 5000),
  is_anonymous boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_reactions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type in ('like','helpful','support')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, reaction_type)
);

create table public.board_post_views (
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, viewed_on)
);

create table public.board_attachments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  post_id uuid references public.board_posts(id) on delete cascade,
  comment_id uuid references public.board_comments(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint attachment_owner check ((post_id is not null)::integer + (comment_id is not null)::integer = 1)
);

create index dashboard_assignments_widget_idx on public.dashboard_widget_assignments(widget_id, effect);
create index boards_group_sort_idx on public.boards(group_id, sort_order, name);
create index board_rules_lookup_idx on public.board_permission_rules(board_id, action, effect);
create index board_recent_visits_user_idx on public.board_recent_visits(user_id, visited_at desc);
create index board_posts_list_idx on public.board_posts(board_id, status, is_pinned desc, created_at desc);
create index board_comments_post_idx on public.board_comments(post_id, created_at);
create index board_attachments_post_idx on public.board_attachments(post_id) where deleted_at is null;

create trigger dashboard_widgets_set_updated_at before update on public.dashboard_widgets for each row execute function public.set_updated_at();
create trigger board_groups_set_updated_at before update on public.board_groups for each row execute function public.set_updated_at();
create trigger boards_set_updated_at before update on public.boards for each row execute function public.set_updated_at();
create trigger board_categories_set_updated_at before update on public.board_categories for each row execute function public.set_updated_at();
create trigger board_rules_set_updated_at before update on public.board_permission_rules for each row execute function public.set_updated_at();
create trigger board_posts_set_updated_at before update on public.board_posts for each row execute function public.set_updated_at();
create trigger board_comments_set_updated_at before update on public.board_comments for each row execute function public.set_updated_at();

create or replace function public.dashboard_target_matches(p_target_type text, p_target_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select case p_target_type
    when 'all' then true
    when 'user' then p_target_id = p_user_id::text
    when 'role' then exists (select 1 from public.user_role_assignments where user_id = p_user_id and role_code = p_target_id)
    when 'department' then exists (select 1 from public.profiles where id = p_user_id and department_id::text = p_target_id)
    when 'position' then exists (select 1 from public.profiles where id = p_user_id and position_id::text = p_target_id)
    when 'job_title' then exists (select 1 from public.profiles where id = p_user_id and job_title_id::text = p_target_id)
    else false end;
$$;

create or replace function public.can_manage_dashboard_widgets()
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select public.is_membership_admin();
$$;

create or replace function public.get_my_dashboard_widgets()
returns table (id uuid, widget_type text, title text, description text, route text, configuration jsonb, size text, display_order integer, is_required boolean, allow_user_hide boolean, allow_user_reorder boolean, is_hidden boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select w.id, w.widget_type, w.title, w.description, w.route, w.configuration, w.size,
    coalesce(p.custom_order, w.sort_order), w.is_required, w.allow_user_hide, w.allow_user_reorder,
    case when w.is_required or not w.allow_user_hide then false else coalesce(p.is_hidden, false) end
  from public.dashboard_widgets w
  left join public.user_dashboard_preferences p on p.widget_id = w.id and p.user_id = auth.uid()
  where public.is_approved_member() and w.is_active and w.archived_at is null
    and exists (select 1 from public.dashboard_widget_assignments a where a.widget_id = w.id and a.effect = 'allow' and public.dashboard_target_matches(a.target_type, a.target_id, auth.uid()))
    and not exists (select 1 from public.dashboard_widget_assignments a where a.widget_id = w.id and a.effect = 'deny' and public.dashboard_target_matches(a.target_type, a.target_id, auth.uid()))
  order by coalesce(p.custom_order, w.sort_order), w.created_at;
$$;

create or replace function public.set_my_dashboard_preference(p_widget_id uuid, p_custom_order integer, p_is_hidden boolean)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare w public.dashboard_widgets;
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  select * into w from public.dashboard_widgets where id=p_widget_id and is_active and archived_at is null;
  if w.id is null then raise exception 'widget_not_found'; end if;
  if p_is_hidden and (w.is_required or not w.allow_user_hide) then raise exception 'widget_cannot_be_hidden' using errcode='42501'; end if;
  if p_custom_order is not null and not w.allow_user_reorder then raise exception 'widget_cannot_be_reordered' using errcode='42501'; end if;
  insert into public.user_dashboard_preferences(user_id,widget_id,custom_order,is_hidden,updated_at)
  values(auth.uid(),p_widget_id,p_custom_order,coalesce(p_is_hidden,false),now())
  on conflict(user_id,widget_id) do update set custom_order=excluded.custom_order,is_hidden=excluded.is_hidden,updated_at=now();
end; $$;

create or replace function public.manage_dashboard_widget(p_widget jsonb, p_assignments jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare result_id uuid; before_data jsonb; after_data jsonb; assignment jsonb;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  result_id := nullif(p_widget->>'id','')::uuid;
  if result_id is null then
    insert into public.dashboard_widgets(widget_type,title,description,route,configuration,size,sort_order,is_required,allow_user_hide,allow_user_reorder,is_active,created_by)
    values(p_widget->>'widget_type',p_widget->>'title',p_widget->>'description',nullif(p_widget->>'route',''),coalesce(p_widget->'configuration','{}'),coalesce(p_widget->>'size','medium'),coalesce((p_widget->>'sort_order')::integer,0),coalesce((p_widget->>'is_required')::boolean,false),coalesce((p_widget->>'allow_user_hide')::boolean,true),coalesce((p_widget->>'allow_user_reorder')::boolean,true),coalesce((p_widget->>'is_active')::boolean,true),auth.uid()) returning id into result_id;
  else
    select to_jsonb(w) into before_data from public.dashboard_widgets w where id=result_id for update;
    if before_data is null then raise exception 'widget_not_found'; end if;
    update public.dashboard_widgets set widget_type=p_widget->>'widget_type',title=p_widget->>'title',description=p_widget->>'description',route=nullif(p_widget->>'route',''),configuration=coalesce(p_widget->'configuration','{}'),size=coalesce(p_widget->>'size','medium'),sort_order=coalesce((p_widget->>'sort_order')::integer,0),is_required=coalesce((p_widget->>'is_required')::boolean,false),allow_user_hide=coalesce((p_widget->>'allow_user_hide')::boolean,true),allow_user_reorder=coalesce((p_widget->>'allow_user_reorder')::boolean,true),is_active=coalesce((p_widget->>'is_active')::boolean,true),archived_at=case when coalesce((p_widget->>'archived')::boolean,false) then now() else null end where id=result_id;
  end if;
  delete from public.dashboard_widget_assignments where widget_id=result_id;
  for assignment in select value from jsonb_array_elements(coalesce(p_assignments,'[]')) loop
    insert into public.dashboard_widget_assignments(widget_id,target_type,target_id,effect,created_by) values(result_id,assignment->>'target_type',nullif(assignment->>'target_id',''),assignment->>'effect',auth.uid());
  end loop;
  select to_jsonb(w) into after_data from public.dashboard_widgets w where id=result_id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),case when before_data is null then 'dashboard.widget.created' else 'dashboard.widget.updated' end,'dashboard_widget',result_id::text,before_data,after_data);
  return result_id;
end; $$;

create or replace function public.get_dashboard_admin_catalog()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'widgets',coalesce((select jsonb_agg(to_jsonb(w) order by sort_order,title) from public.dashboard_widgets w),'[]'),
    'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by created_at) from public.dashboard_widget_assignments a),'[]')
  );
end; $$;

create or replace function public.delete_or_archive_dashboard_widget(p_widget_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare used boolean;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  select exists(select 1 from public.user_dashboard_preferences where widget_id=p_widget_id) into used;
  if used then update public.dashboard_widgets set archived_at=coalesce(archived_at,now()),is_active=false where id=p_widget_id; else delete from public.dashboard_widgets where id=p_widget_id; end if;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),case when used then 'dashboard.widget.archived_for_usage' else 'dashboard.widget.deleted' end,'dashboard_widget',p_widget_id::text,jsonb_build_object('has_usage',used));
  return case when used then 'archived' else 'deleted' end;
end; $$;

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

create or replace function public.evaluate_board_access(p_board_id uuid, p_action text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.profiles where id=p_user_id and membership_status='approved') and (
    exists(select 1 from public.user_role_assignments where user_id=p_user_id and role_code='super_admin') or (
      exists(select 1 from public.boards where id=p_board_id and is_active and archived_at is null)
      and exists(select 1 from public.board_permission_rules r where r.board_id=p_board_id and r.action=p_action and r.effect='allow' and public.board_target_matches(p_board_id,r.target_type,r.target_id,p_user_id))
      and not exists(select 1 from public.board_permission_rules r where r.board_id=p_board_id and r.action=p_action and r.effect='deny' and public.board_target_matches(p_board_id,r.target_type,r.target_id,p_user_id))
    )
  );
$$;

create or replace function public.can_access_board(p_board_id uuid, p_action text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid() is not null and public.evaluate_board_access(p_board_id,p_action,auth.uid());
$$;

create or replace function public.get_my_visible_boards()
returns table(id uuid,group_id uuid,group_name text,name text,slug text,description text,board_type text,settings jsonb,sort_order integer,is_favorite boolean,last_visited_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $$
  select b.id,b.group_id,g.name,b.name,b.slug,b.description,b.board_type,b.settings,b.sort_order,
    exists(select 1 from public.board_favorites f where f.board_id=b.id and f.user_id=auth.uid()),
    (select v.visited_at from public.board_recent_visits v where v.board_id=b.id and v.user_id=auth.uid())
  from public.boards b left join public.board_groups g on g.id=b.group_id
  where b.is_active and b.archived_at is null and coalesce((b.settings->>'show_in_sidebar')::boolean,true) and public.can_access_board(b.id,'sidebar_view')
  order by g.sort_order,b.sort_order,b.name;
$$;

create or replace function public.get_board_overview(p_slug text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare b public.boards; result jsonb;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then raise exception 'board_access_denied' using errcode='42501'; end if;
  insert into public.board_recent_visits(board_id,user_id,visited_at) values(b.id,auth.uid(),now()) on conflict(board_id,user_id) do update set visited_at=excluded.visited_at;
  select jsonb_build_object('board',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'board_type',b.board_type,'settings',b.settings),'permissions',jsonb_build_object('create',public.can_access_board(b.id,'post_create'),'comment',public.can_access_board(b.id,'comment_create'),'upload',public.can_access_board(b.id,'attachment_upload'),'notice',public.can_access_board(b.id,'notice_manage')),'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',c.code) order by c.sort_order,c.name) from public.board_categories c where c.board_id=b.id and c.is_active),'[]')) into result;
  return result;
end; $$;

create or replace function public.get_board_posts(p_slug text,p_search text default null,p_category uuid default null,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare b public.boards; page_size integer; result jsonb;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then raise exception 'board_access_denied' using errcode='42501'; end if;
  page_size:=least(greatest(coalesce((b.settings->>'page_size')::integer,20),5),100);
  select jsonb_build_object('items',coalesce(jsonb_agg(item order by (item->>'is_pinned')::boolean desc,(item->>'created_at')::timestamptz desc),'[]'),'page',greatest(p_page,1),'page_size',page_size) into result from (
    select jsonb_build_object('id',p.id,'title',p.title,'prefix',p.post_prefix,'category',c.name,'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,'view_count',p.view_count,'comment_count',p.comment_count,'attachment_count',p.attachment_count,'created_at',p.created_at,'author_name',case when p.is_anonymous then '익명' else pr.name end) item
    from public.board_posts p left join public.profiles pr on pr.id=p.author_user_id left join public.board_categories c on c.id=p.category_id
    where p.board_id=b.id and p.status='published' and p.deleted_at is null and (p_category is null or p.category_id=p_category) and (coalesce(btrim(p_search),'')='' or p.title ilike '%'||p_search||'%' or p.content ilike '%'||p_search||'%')
    order by p.is_pinned desc,p.created_at desc limit page_size offset (greatest(p_page,1)-1)*page_size
  ) rows;
  return result;
end; $$;

create or replace function public.get_my_dashboard_widgets()
returns table (id uuid, widget_type text, title text, description text, route text, configuration jsonb, size text, display_order integer, is_required boolean, allow_user_hide boolean, allow_user_reorder boolean, is_hidden boolean)
language sql stable security definer set search_path = pg_catalog as $$
  select w.id, w.widget_type, w.title, w.description, w.route,
    case when w.widget_type in ('notices','recent_posts') then w.configuration || jsonb_build_object('items',coalesce((select jsonb_agg(item order by (item->>'created_at')::timestamptz desc) from (select jsonb_build_object('id',p.id,'title',p.title,'board_slug',b.slug,'board_name',b.name,'created_at',p.created_at) item from public.board_posts p join public.boards b on b.id=p.board_id where p.status='published' and p.deleted_at is null and public.evaluate_board_access(b.id,'list_read',auth.uid()) and (w.widget_type='recent_posts' or p.is_notice) order by p.created_at desc limit 5) latest),'[]')) else w.configuration end,
    w.size,coalesce(p.custom_order,w.sort_order),w.is_required,w.allow_user_hide,w.allow_user_reorder,
    case when w.is_required or not w.allow_user_hide then false else coalesce(p.is_hidden,false) end
  from public.dashboard_widgets w
  left join public.user_dashboard_preferences p on p.widget_id=w.id and p.user_id=auth.uid()
  where public.is_approved_member() and w.is_active and w.archived_at is null
    and exists(select 1 from public.dashboard_widget_assignments a where a.widget_id=w.id and a.effect='allow' and public.dashboard_target_matches(a.target_type,a.target_id,auth.uid()))
    and not exists(select 1 from public.dashboard_widget_assignments a where a.widget_id=w.id and a.effect='deny' and public.dashboard_target_matches(a.target_type,a.target_id,auth.uid()))
  order by coalesce(p.custom_order,w.sort_order),w.created_at;
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
  select jsonb_build_object('post',jsonb_build_object('id',p.id,'board_id',p.board_id,'category_id',p.category_id,'title',p.title,'content',p.content,'prefix',p.post_prefix,'is_anonymous',p.is_anonymous,'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,'view_count',p.view_count,'created_at',p.created_at,'edited_at',p.edited_at,'author_name',author_name,'can_edit',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_update')) or public.can_access_board(p.board_id,'other_post_update'),'can_delete',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_delete')) or public.can_access_board(p.board_id,'other_post_delete')),'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'parent_comment_id',c.parent_comment_id,'content',case when c.deleted_at is null then c.content else '삭제된 댓글입니다.' end,'author_name',case when c.deleted_at is not null then '' when c.is_anonymous then '익명' else cp.name end,'created_at',c.created_at,'can_edit',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_update')) or public.can_access_board(c.board_id,'other_comment_update')),'can_delete',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_delete')) or public.can_access_board(c.board_id,'other_comment_delete'))) order by c.created_at) from public.board_comments c left join public.profiles cp on cp.id=c.author_user_id where c.post_id=p.id),'[]'),'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'original_name',a.original_name,'mime_type',a.mime_type,'file_size',a.file_size)) from public.board_attachments a where a.post_id=p.id and a.deleted_at is null and public.can_access_board(a.board_id,'attachment_view')),'[]')) into result;
  return result;
end; $$;

create or replace function public.save_board_post(p_post_id uuid,p_board_id uuid,p_title text,p_content text,p_category_id uuid,p_is_anonymous boolean,p_is_notice boolean,p_status text default 'published')
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; existing public.board_posts; settings jsonb;
begin
  if p_category_id is not null and not exists(select 1 from public.board_categories c where c.id=p_category_id and c.board_id=p_board_id and c.is_active) then raise exception 'invalid_category' using errcode='22023'; end if;
  if p_post_id is null then
    if not public.can_access_board(p_board_id,'post_create') then raise exception 'post_create_denied' using errcode='42501'; end if;
    select b.settings into settings from public.boards b where id=p_board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    if p_is_notice and not public.can_access_board(p_board_id,'notice_manage') then raise exception 'notice_manage_denied' using errcode='42501'; end if;
    insert into public.board_posts(board_id,category_id,author_user_id,title,content,is_anonymous,is_notice,status,published_at) values(p_board_id,p_category_id,auth.uid(),btrim(p_title),coalesce(p_content,''),coalesce(p_is_anonymous,false),coalesce(p_is_notice,false),coalesce(p_status,'published'),case when p_status='published' then now() end) returning id into result_id;
  else
    select * into existing from public.board_posts where id=p_post_id for update;
    if existing.id is null or not ((existing.author_user_id=auth.uid() and public.can_access_board(existing.board_id,'own_post_update')) or public.can_access_board(existing.board_id,'other_post_update')) then raise exception 'post_update_denied' using errcode='42501'; end if;
    select b.settings into settings from public.boards b where id=existing.board_id;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    update public.board_posts set category_id=p_category_id,title=btrim(p_title),content=coalesce(p_content,''),is_anonymous=coalesce(p_is_anonymous,false),is_notice=case when public.can_access_board(existing.board_id,'notice_manage') then coalesce(p_is_notice,false) else existing.is_notice end,status=coalesce(p_status,existing.status),published_at=case when p_status='published' then coalesce(existing.published_at,now()) else existing.published_at end,edited_at=now() where id=p_post_id returning id into result_id;
  end if;
  return result_id;
end; $$;

create or replace function public.delete_board_post(p_post_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare p public.board_posts;
begin select * into p from public.board_posts where id=p_post_id for update;
  if p.id is null or not ((p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_delete')) or public.can_access_board(p.board_id,'other_post_delete')) then raise exception 'post_delete_denied' using errcode='42501'; end if;
  update public.board_posts set status='deleted',deleted_at=now() where id=p.id;
end; $$;

create or replace function public.save_board_comment(p_comment_id uuid,p_post_id uuid,p_parent_comment_id uuid,p_content text,p_is_anonymous boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare p public.board_posts; c public.board_comments; result_id uuid; settings jsonb;
begin select * into p from public.board_posts where id=p_post_id;
  if p_comment_id is null then
    if p.id is null or not public.can_access_board(p.board_id,'comment_create') then raise exception 'comment_create_denied' using errcode='42501'; end if;
    select b.settings into settings from public.boards b where id=p.board_id;
    if not coalesce((settings->>'allow_comments')::boolean,true) then raise exception 'comments_disabled' using errcode='42501'; end if;
    if p_parent_comment_id is not null and (not coalesce((settings->>'allow_replies')::boolean,true) or not exists(select 1 from public.board_comments where id=p_parent_comment_id and post_id=p.id)) then raise exception 'invalid_reply' using errcode='22023'; end if;
    if p_is_anonymous and not coalesce((settings->>'allow_anonymous')::boolean,false) then raise exception 'anonymous_not_allowed' using errcode='42501'; end if;
    insert into public.board_comments(board_id,post_id,parent_comment_id,author_user_id,content,is_anonymous) values(p.board_id,p.id,p_parent_comment_id,auth.uid(),btrim(p_content),coalesce(p_is_anonymous,false)) returning id into result_id;
    update public.board_posts set comment_count=comment_count+1 where id=p.id;
  else
    select * into c from public.board_comments where id=p_comment_id for update;
    if c.id is null or not ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_update')) or public.can_access_board(c.board_id,'other_comment_update')) then raise exception 'comment_update_denied' using errcode='42501'; end if;
    update public.board_comments set content=btrim(p_content),updated_at=now() where id=c.id returning id into result_id;
  end if; return result_id;
end; $$;

create or replace function public.delete_board_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare c public.board_comments;
begin select * into c from public.board_comments where id=p_comment_id for update;
  if c.id is null or not ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_delete')) or public.can_access_board(c.board_id,'other_comment_delete')) then raise exception 'comment_delete_denied' using errcode='42501'; end if;
  update public.board_comments set deleted_at=now() where id=c.id;
end; $$;

create or replace function public.toggle_board_favorite(p_board_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin if not public.can_access_board(p_board_id,'sidebar_view') then raise exception 'board_access_denied' using errcode='42501'; end if;
  if exists(select 1 from public.board_favorites where board_id=p_board_id and user_id=auth.uid()) then delete from public.board_favorites where board_id=p_board_id and user_id=auth.uid(); return false;
  else insert into public.board_favorites(board_id,user_id) values(p_board_id,auth.uid()); return true; end if;
end; $$;

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
end; $$;

create or replace function public.get_board_admin_catalog() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
return jsonb_build_object(
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by sort_order,name) from public.board_groups g),'[]'),
  'boards',coalesce((select jsonb_agg(to_jsonb(b) order by sort_order,name) from public.boards b where public.has_role('super_admin') or exists(select 1 from public.board_managers m where m.board_id=b.id and m.user_id=auth.uid()) or public.can_access_board(b.id,'board_setting_manage')),'[]'),
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.board_categories c join public.boards b on b.id=c.board_id where public.has_role('super_admin') or exists(select 1 from public.board_managers m where m.board_id=b.id and m.user_id=auth.uid()) or public.can_access_board(b.id,'category_manage')),'[]'),
  'rules',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.board_permission_rules r join public.boards b on b.id=r.board_id where public.has_role('super_admin') or exists(select 1 from public.board_managers m where m.board_id=b.id and m.user_id=auth.uid()) or public.can_access_board(b.id,'permission_manage')),'[]'),
  'managers',coalesce((select jsonb_agg(to_jsonb(m) order by m.assigned_at) from public.board_managers m join public.boards b on b.id=m.board_id where public.has_role('super_admin') or m.user_id=auth.uid() or public.can_access_board(b.id,'permission_manage')),'[]'),
  'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',p.email) order by p.name) from public.profiles p where p.membership_status='approved'),'[]')
);
end; $$;

create or replace function public.manage_board_group(p_group jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; before_data jsonb; after_data jsonb;
begin
  if not public.has_role('super_admin') then raise exception 'super_admin_required' using errcode='42501'; end if;
  result_id:=nullif(p_group->>'id','')::uuid;
  if result_id is null then
    insert into public.board_groups(name,code,description,sort_order,is_active) values(p_group->>'name',p_group->>'code',p_group->>'description',coalesce((p_group->>'sort_order')::integer,0),coalesce((p_group->>'is_active')::boolean,true)) returning id into result_id;
  else
    select to_jsonb(g) into before_data from public.board_groups g where id=result_id for update;
    if before_data is null then raise exception 'board_group_not_found'; end if;
    update public.board_groups set name=p_group->>'name',code=p_group->>'code',description=p_group->>'description',sort_order=coalesce((p_group->>'sort_order')::integer,0),is_active=coalesce((p_group->>'is_active')::boolean,true),archived_at=case when coalesce((p_group->>'archived')::boolean,false) then now() else null end where id=result_id;
  end if;
  select to_jsonb(g) into after_data from public.board_groups g where id=result_id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data) values(auth.uid(),case when before_data is null then 'board_group.created' else 'board_group.updated' end,'board_group',result_id::text,before_data,after_data);
  return result_id;
end; $$;

create or replace function public.preview_board_permissions(p_board_id uuid,p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare action_name text; result jsonb:='{}'::jsonb;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  for action_name in select unnest(array['sidebar_view','list_read','detail_read','post_create','own_post_update','own_post_delete','other_post_update','other_post_delete','comment_create','own_comment_update','own_comment_delete','other_comment_update','other_comment_delete','attachment_view','attachment_download','attachment_upload','notice_manage','pin_manage','category_manage','permission_manage','board_setting_manage','archive_manage','board_delete']) loop
    result:=result||jsonb_build_object(action_name,public.evaluate_board_access(p_board_id,action_name,p_user_id));
  end loop;
  return result;
end; $$;

create or replace function public.delete_or_archive_board(p_board_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare has_usage boolean;
begin
  if not public.has_role('super_admin') and not public.can_access_board(p_board_id,'board_delete') then raise exception 'board_delete_denied' using errcode='42501'; end if;
  select exists(select 1 from public.board_posts where board_id=p_board_id) or exists(select 1 from public.board_attachments where board_id=p_board_id) into has_usage;
  if has_usage then update public.boards set archived_at=coalesce(archived_at,now()),is_active=false where id=p_board_id; else delete from public.boards where id=p_board_id; end if;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),case when has_usage then 'board.archived_for_usage' else 'board.deleted' end,'board',p_board_id::text,jsonb_build_object('has_usage',has_usage));
  return case when has_usage then 'archived' else 'deleted' end;
end; $$;

create or replace function public.register_board_attachment(p_board_id uuid,p_post_id uuid,p_storage_path text,p_original_name text,p_mime_type text,p_file_size bigint)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result_id uuid; p public.board_posts; settings jsonb; max_bytes bigint;
begin
  select * into p from public.board_posts where id=p_post_id and board_id=p_board_id;
  if p.id is null or not public.can_access_board(p_board_id,'attachment_upload') then raise exception 'attachment_upload_denied' using errcode='42501'; end if;
  select b.settings into settings from public.boards b where id=p_board_id;
  if not coalesce((settings->>'allow_attachments')::boolean,false) then raise exception 'attachments_disabled' using errcode='42501'; end if;
  max_bytes:=least(greatest(coalesce((settings->>'max_file_size_mb')::integer,20),1),20)*1024*1024;
  if split_part(p_storage_path,'/',1)<>p_board_id::text or split_part(p_storage_path,'/',2)<>auth.uid()::text then raise exception 'invalid_storage_path' using errcode='22023'; end if;
  if p_file_size<=0 or p_file_size>max_bytes or p_original_name~* '\.(exe|dll|bat|cmd|com|scr|msi|js|jar|sh|ps1)$' then raise exception 'unsafe_attachment' using errcode='22023'; end if;
  insert into public.board_attachments(board_id,post_id,storage_path,original_name,mime_type,file_size,uploaded_by) values(p_board_id,p_post_id,p_storage_path,left(p_original_name,255),p_mime_type,p_file_size,auth.uid()) returning id into result_id;
  update public.board_posts set attachment_count=attachment_count+1 where id=p_post_id;
  return result_id;
end; $$;

create or replace function public.get_board_attachment_path(p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a public.board_attachments;
begin select * into a from public.board_attachments where id=p_attachment_id and deleted_at is null;
  if a.id is null or not public.can_access_board(a.board_id,'attachment_download') then raise exception 'attachment_download_denied' using errcode='42501'; end if;
  return jsonb_build_object('storage_path',a.storage_path,'original_name',a.original_name);
end; $$;

create or replace function public.get_board_reactions(p_post_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare board_id uuid;
begin
  select p.board_id into board_id from public.board_posts p where p.id=p_post_id and p.status='published' and p.deleted_at is null;
  if board_id is null or not public.can_access_board(board_id,'detail_read') then raise exception 'post_access_denied' using errcode='42501'; end if;
  return jsonb_build_object(
    'counts',coalesce((select jsonb_object_agg(reaction_type,total) from (select reaction_type,count(*) total from public.board_reactions where post_id=p_post_id group by reaction_type) grouped),'{}'),
    'mine',coalesce((select jsonb_agg(reaction_type order by reaction_type) from public.board_reactions where post_id=p_post_id and user_id=auth.uid()),'[]')
  );
end; $$;

create or replace function public.toggle_board_reaction(p_post_id uuid,p_reaction_type text default 'like')
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare board_id uuid; settings jsonb;
begin
  select p.board_id,b.settings into board_id,settings from public.board_posts p join public.boards b on b.id=p.board_id where p.id=p_post_id and p.status='published' and p.deleted_at is null;
  if board_id is null or not public.can_access_board(board_id,'detail_read') or not coalesce((settings->>'allow_reactions')::boolean,false) then raise exception 'reaction_denied' using errcode='42501'; end if;
  if p_reaction_type not in ('like','helpful','support') then raise exception 'invalid_reaction' using errcode='22023'; end if;
  if exists(select 1 from public.board_reactions where post_id=p_post_id and user_id=auth.uid() and reaction_type=p_reaction_type) then
    delete from public.board_reactions where post_id=p_post_id and user_id=auth.uid() and reaction_type=p_reaction_type;
  else
    insert into public.board_reactions(board_id,post_id,user_id,reaction_type) values(board_id,p_post_id,auth.uid(),p_reaction_type);
  end if;
  return public.get_board_reactions(p_post_id);
end; $$;

create or replace function public.delete_board_attachment(p_attachment_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare attachment public.board_attachments;
begin
  select * into attachment from public.board_attachments where id=p_attachment_id and deleted_at is null for update;
  if attachment.id is null or not (attachment.uploaded_by=auth.uid() or public.can_access_board(attachment.board_id,'other_post_update')) then raise exception 'attachment_delete_denied' using errcode='42501'; end if;
  update public.board_attachments set deleted_at=now() where id=attachment.id;
  if attachment.post_id is not null then update public.board_posts set attachment_count=greatest(attachment_count-1,0) where id=attachment.post_id; end if;
end; $$;

create or replace function public.can_read_board_attachment_path(p_storage_path text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.board_attachments a where a.storage_path=p_storage_path and a.deleted_at is null and public.can_access_board(a.board_id,'attachment_download'));
$$;

insert into public.board_groups(name,code,description,sort_order,is_system) values
('회사','company','전사 공지와 업무 게시판',10,true),('부서','department','부서별 게시판',20,true),('프로젝트','project','프로젝트 게시판',30,true),('보관','archived','보관된 게시판',999,true);

with new_board as (
  insert into public.boards(group_id,name,slug,description,board_type,settings,sort_order)
  select id,'공지사항','company-notice','전 임직원 공지 게시판','notice','{"show_in_sidebar":true,"allow_comments":true,"allow_replies":true,"allow_attachments":true,"allow_images":true,"allow_anonymous":false,"show_views":true,"allow_reactions":true,"show_post_number":true,"search_enabled":true,"page_size":20,"default_sort":"latest","max_file_size_mb":20}'::jsonb,10 from public.board_groups where code='company' returning id
)
insert into public.board_permission_rules(board_id,action,target_type,effect)
select id,action,'all','allow' from new_board cross join unnest(array['sidebar_view','list_read','detail_read','comment_create','own_comment_update','own_comment_delete','attachment_view','attachment_download']) action;

with widget as (
  insert into public.dashboard_widgets(widget_type,title,description,route,size,sort_order,is_required,allow_user_hide)
  values('notices','공지사항','최근 전사 공지를 확인합니다.','/boards/company-notice','large',10,true,false),('recent_posts','최근 게시글','접근 가능한 게시판의 최신 글을 확인합니다.','/boards','medium',20,false,true),('approval_status','결재 현황','전자결재 기능은 준비 중입니다.','/approval','medium',30,false,true),('today_schedule','오늘 일정','일정 기능은 준비 중입니다.','/calendar','medium',40,false,true),('mail_link','메일 바로가기','회사 웹메일로 이동합니다.','https://mail.jeakyung.com','small',50,false,true)
  returning id
)
insert into public.dashboard_widget_assignments(widget_id,target_type,effect) select id,'all','allow' from widget;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('groupware-board-attachments','groupware-board-attachments',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;

alter table public.dashboard_widgets enable row level security;
alter table public.dashboard_widget_assignments enable row level security;
alter table public.user_dashboard_preferences enable row level security;
alter table public.board_groups enable row level security;
alter table public.boards enable row level security;
alter table public.board_categories enable row level security;
alter table public.board_permission_rules enable row level security;
alter table public.board_managers enable row level security;
alter table public.board_favorites enable row level security;
alter table public.board_recent_visits enable row level security;
alter table public.board_posts enable row level security;
alter table public.board_comments enable row level security;
alter table public.board_reactions enable row level security;
alter table public.board_post_views enable row level security;
alter table public.board_attachments enable row level security;

create policy dashboard_preferences_self on public.user_dashboard_preferences for all to authenticated using(user_id=auth.uid() and public.is_approved_member()) with check(user_id=auth.uid() and public.is_approved_member());
create policy board_favorites_self on public.board_favorites for all to authenticated using(user_id=auth.uid() and public.can_access_board(board_id,'sidebar_view')) with check(user_id=auth.uid() and public.can_access_board(board_id,'sidebar_view'));
create policy board_recent_visits_self on public.board_recent_visits for all to authenticated using(user_id=auth.uid() and public.can_access_board(board_id,'sidebar_view')) with check(user_id=auth.uid() and public.can_access_board(board_id,'sidebar_view'));
create policy storage_board_upload on storage.objects for insert to authenticated with check(bucket_id='groupware-board-attachments' and public.can_access_board((storage.foldername(name))[1]::uuid,'attachment_upload') and (storage.foldername(name))[2]=auth.uid()::text);
create policy storage_board_read on storage.objects for select to authenticated using(bucket_id='groupware-board-attachments' and public.can_read_board_attachment_path(name));
create policy storage_board_delete on storage.objects for delete to authenticated using(bucket_id='groupware-board-attachments' and (storage.foldername(name))[2]=auth.uid()::text);

revoke all on table public.dashboard_widgets,public.dashboard_widget_assignments,public.user_dashboard_preferences,public.board_groups,public.boards,public.board_categories,public.board_permission_rules,public.board_managers,public.board_favorites,public.board_recent_visits,public.board_posts,public.board_comments,public.board_reactions,public.board_post_views,public.board_attachments from anon,authenticated;
grant select,insert,update,delete on public.user_dashboard_preferences to authenticated;
grant select,insert,delete on public.board_favorites to authenticated;
grant select,insert,update,delete on public.board_recent_visits to authenticated;

revoke all on function public.dashboard_target_matches(text,text,uuid),public.board_target_matches(uuid,text,text,uuid),public.evaluate_board_access(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.can_manage_dashboard_widgets(),public.get_my_dashboard_widgets(),public.set_my_dashboard_preference(uuid,integer,boolean),public.manage_dashboard_widget(jsonb,jsonb),public.get_dashboard_admin_catalog(),public.delete_or_archive_dashboard_widget(uuid),public.can_access_board(uuid,text),public.get_my_visible_boards(),public.get_board_overview(text),public.get_board_posts(text,text,uuid,integer),public.get_board_post(uuid),public.save_board_post(uuid,uuid,text,text,uuid,boolean,boolean,text),public.delete_board_post(uuid),public.save_board_comment(uuid,uuid,uuid,text,boolean),public.delete_board_comment(uuid),public.toggle_board_favorite(uuid),public.manage_board(jsonb,jsonb,jsonb,jsonb),public.get_board_admin_catalog(),public.manage_board_group(jsonb),public.preview_board_permissions(uuid,uuid),public.delete_or_archive_board(uuid),public.register_board_attachment(uuid,uuid,text,text,text,bigint),public.get_board_attachment_path(uuid),public.get_board_reactions(uuid),public.toggle_board_reaction(uuid,text),public.delete_board_attachment(uuid) from public,anon;
revoke all on function public.can_read_board_attachment_path(text) from public,anon;
grant execute on function public.can_manage_dashboard_widgets(),public.get_my_dashboard_widgets(),public.set_my_dashboard_preference(uuid,integer,boolean),public.manage_dashboard_widget(jsonb,jsonb),public.get_dashboard_admin_catalog(),public.delete_or_archive_dashboard_widget(uuid),public.can_access_board(uuid,text),public.get_my_visible_boards(),public.get_board_overview(text),public.get_board_posts(text,text,uuid,integer),public.get_board_post(uuid),public.save_board_post(uuid,uuid,text,text,uuid,boolean,boolean,text),public.delete_board_post(uuid),public.save_board_comment(uuid,uuid,uuid,text,boolean),public.delete_board_comment(uuid),public.toggle_board_favorite(uuid),public.manage_board(jsonb,jsonb,jsonb,jsonb),public.get_board_admin_catalog(),public.manage_board_group(jsonb),public.preview_board_permissions(uuid,uuid),public.delete_or_archive_board(uuid),public.register_board_attachment(uuid,uuid,text,text,text,bigint),public.get_board_attachment_path(uuid),public.get_board_reactions(uuid),public.toggle_board_reaction(uuid,text),public.delete_board_attachment(uuid),public.can_read_board_attachment_path(text) to authenticated;

commit;
