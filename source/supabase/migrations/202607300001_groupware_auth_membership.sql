begin;

create extension if not exists pgcrypto;

create type public.membership_status as enum (
  'pending',
  'approved',
  'rejected',
  'locked',
  'resigned'
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 60),
  name text not null check (char_length(name) between 1 and 120),
  parent_id uuid references public.departments(id) on delete restrict,
  sort_order integer not null default 0,
  head_user_id uuid,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_parent_not_self check (parent_id is null or parent_id <> id)
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 60),
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_titles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 60),
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null,
  phone text check (phone is null or char_length(phone) <= 40),
  membership_status public.membership_status not null default 'pending',
  department_id uuid references public.departments(id) on delete restrict,
  position_id uuid references public.positions(id) on delete restrict,
  job_title_id uuid references public.job_titles(id) on delete restrict,
  requested_department_id uuid references public.departments(id) on delete set null,
  requested_position_id uuid references public.positions(id) on delete set null,
  requested_job_title_id uuid references public.job_titles(id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  resigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments
  add constraint departments_head_user_fkey
  foreign key (head_user_id) references public.profiles(id) on delete set null;

create table public.roles (
  code text primary key,
  name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint roles_fixed_code check (
    code in ('super_admin', 'admin', 'department_head', 'team_lead', 'employee')
  )
);

create table public.user_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null references public.roles(code) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_membership_status_idx on public.profiles(membership_status, created_at);
create index profiles_requested_department_idx on public.profiles(requested_department_id);
create index departments_parent_sort_idx on public.departments(parent_id, sort_order, name);
create index user_role_assignments_role_idx on public.user_role_assignments(role_code, user_id);
create index audit_logs_target_idx on public.audit_logs(target_type, target_id, created_at desc);

insert into public.roles (code, name, sort_order)
values
  ('super_admin', '최고 관리자', 10),
  ('admin', '관리자', 20),
  ('department_head', '부서장', 30),
  ('team_lead', '팀장', 40),
  ('employee', '직원', 50);

insert into public.departments (code, name, sort_order)
values ('unconfirmed', '[미정] 소속 부서', 999);

insert into public.positions (code, name, sort_order)
values ('unconfirmed', '[미정] 직급', 999);

insert into public.job_titles (code, name, sort_order)
values ('unconfirmed', '[미정] 직책', 999);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create trigger positions_set_updated_at
before update on public.positions
for each row execute function public.set_updated_at();

create trigger job_titles_set_updated_at
before update on public.job_titles
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  requested_department uuid;
  requested_position uuid;
  requested_job_title uuid;
begin
  select id into requested_department
  from public.departments
  where id::text = coalesce(new.raw_user_meta_data ->> 'requested_department_id', '')
    and is_active;

  select id into requested_position
  from public.positions
  where id::text = coalesce(new.raw_user_meta_data ->> 'requested_position_id', '')
    and is_active;

  select id into requested_job_title
  from public.job_titles
  where id::text = coalesce(new.raw_user_meta_data ->> 'requested_job_title_id', '')
    and is_active;

  insert into public.profiles (
    id,
    name,
    email,
    phone,
    membership_status,
    requested_department_id,
    requested_position_id,
    requested_job_title_id
  )
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 120),
    coalesce(new.email, ''),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), 40),
    'pending',
    requested_department,
    requested_position,
    requested_job_title
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise log 'handle_new_auth_user failed for user %: %', new.id, sqlerrm;
    raise;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.role_code = requested_role
  );
$$;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.membership_status = 'approved'
  );
$$;

create or replace function public.is_membership_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.is_approved_member()
    and (public.has_role('admin') or public.has_role('super_admin'));
$$;

create or replace function public.get_signup_options()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order, name)
      from public.departments where is_active and archived_at is null
    ), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order, name)
      from public.positions where is_active
    ), '[]'::jsonb),
    'job_titles', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order, name)
      from public.job_titles where is_active
    ), '[]'::jsonb)
  );
$$;

create or replace function public.approve_membership(
  p_user_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_job_title_id uuid,
  p_role_code text
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  previous_profile public.profiles;
  approved_profile public.profiles;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  if p_role_code not in ('super_admin', 'admin', 'department_head', 'team_lead', 'employee') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  if p_role_code in ('super_admin', 'admin') and not public.has_role('super_admin') then
    raise exception 'super_admin_required_for_admin_role' using errcode = '42501';
  end if;

  if not exists (select 1 from public.departments where id = p_department_id and is_active and archived_at is null)
    or not exists (select 1 from public.positions where id = p_position_id and is_active)
    or not exists (select 1 from public.job_titles where id = p_job_title_id and is_active) then
    raise exception 'active_organization_values_required' using errcode = '22023';
  end if;

  select * into previous_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if previous_profile.membership_status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = 'P0001';
  end if;

  update public.profiles
  set membership_status = 'approved',
      department_id = p_department_id,
      position_id = p_position_id,
      job_title_id = p_job_title_id,
      approved_at = now(),
      approved_by = auth.uid(),
      rejection_reason = null,
      locked_at = null,
      resigned_at = null
  where id = p_user_id
  returning * into approved_profile;

  insert into public.user_role_assignments (user_id, role_code, assigned_by)
  values (p_user_id, p_role_code, auth.uid())
  on conflict (user_id, role_code) do nothing;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, before_data, after_data, metadata
  ) values (
    auth.uid(),
    'membership.approved',
    'profile',
    p_user_id::text,
    to_jsonb(previous_profile) - 'phone',
    to_jsonb(approved_profile) - 'phone',
    jsonb_build_object('role_code', p_role_code)
  );

  return approved_profile;
end;
$$;

create or replace function public.reject_membership(
  p_user_id uuid,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  previous_profile public.profiles;
  rejected_profile public.profiles;
  normalized_reason text := nullif(btrim(p_reason), '');
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  if normalized_reason is null or char_length(normalized_reason) > 1000 then
    raise exception 'valid_rejection_reason_required' using errcode = '22023';
  end if;

  select * into previous_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if previous_profile.membership_status <> 'pending' then
    raise exception 'membership_not_pending' using errcode = 'P0001';
  end if;

  update public.profiles
  set membership_status = 'rejected',
      rejection_reason = normalized_reason,
      approved_at = null,
      approved_by = auth.uid()
  where id = p_user_id
  returning * into rejected_profile;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, before_data, after_data
  ) values (
    auth.uid(),
    'membership.rejected',
    'profile',
    p_user_id::text,
    to_jsonb(previous_profile) - 'phone',
    to_jsonb(rejected_profile) - 'phone'
  );

  return rejected_profile;
end;
$$;

create or replace function public.upsert_organization_item(
  p_entity text,
  p_id uuid,
  p_code text,
  p_name text,
  p_parent_id uuid,
  p_sort_order integer,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  result_id uuid;
  previous_data jsonb;
  after_data jsonb;
  normalized_code text := lower(nullif(btrim(p_code), ''));
  normalized_name text := nullif(btrim(p_name), '');
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  if p_entity not in ('department', 'position', 'job_title')
    or normalized_code is null
    or normalized_name is null then
    raise exception 'valid_organization_item_required' using errcode = '22023';
  end if;

  if p_entity = 'department' then
    if p_id is not null and p_parent_id = p_id then
      raise exception 'department_parent_cycle' using errcode = '22023';
    end if;

    if p_id is not null and p_parent_id is not null and exists (
      with recursive descendants as (
        select id from public.departments where parent_id = p_id
        union all
        select child.id
        from public.departments child
        join descendants parent on child.parent_id = parent.id
      )
      select 1 from descendants where id = p_parent_id
    ) then
      raise exception 'department_parent_cycle' using errcode = '22023';
    end if;

    if p_id is null then
      insert into public.departments (code, name, parent_id, sort_order, is_active)
      values (normalized_code, normalized_name, p_parent_id, coalesce(p_sort_order, 0), coalesce(p_is_active, true))
      returning id into result_id;
    else
      select to_jsonb(d) into previous_data from public.departments d where id = p_id for update;
      if previous_data is null then raise exception 'department_not_found' using errcode = 'P0002'; end if;
      update public.departments
      set code = normalized_code,
          name = normalized_name,
          parent_id = p_parent_id,
          sort_order = coalesce(p_sort_order, 0),
          is_active = coalesce(p_is_active, true),
          archived_at = case when coalesce(p_is_active, true) then null else coalesce(archived_at, now()) end
      where id = p_id returning id into result_id;
    end if;
    select to_jsonb(d) into after_data from public.departments d where id = result_id;
  elsif p_entity = 'position' then
    if p_id is null then
      insert into public.positions (code, name, sort_order, is_active)
      values (normalized_code, normalized_name, coalesce(p_sort_order, 0), coalesce(p_is_active, true))
      returning id into result_id;
    else
      select to_jsonb(p) into previous_data from public.positions p where id = p_id for update;
      if previous_data is null then raise exception 'position_not_found' using errcode = 'P0002'; end if;
      update public.positions
      set code = normalized_code,
          name = normalized_name,
          sort_order = coalesce(p_sort_order, 0),
          is_active = coalesce(p_is_active, true)
      where id = p_id returning id into result_id;
    end if;
    select to_jsonb(p) into after_data from public.positions p where id = result_id;
  else
    if p_id is null then
      insert into public.job_titles (code, name, sort_order, is_active)
      values (normalized_code, normalized_name, coalesce(p_sort_order, 0), coalesce(p_is_active, true))
      returning id into result_id;
    else
      select to_jsonb(j) into previous_data from public.job_titles j where id = p_id for update;
      if previous_data is null then raise exception 'job_title_not_found' using errcode = 'P0002'; end if;
      update public.job_titles
      set code = normalized_code,
          name = normalized_name,
          sort_order = coalesce(p_sort_order, 0),
          is_active = coalesce(p_is_active, true)
      where id = p_id returning id into result_id;
    end if;
    select to_jsonb(j) into after_data from public.job_titles j where id = result_id;
  end if;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, before_data, after_data
  ) values (
    auth.uid(),
    case when p_id is null then 'organization.created' else 'organization.updated' end,
    p_entity,
    result_id::text,
    previous_data,
    after_data
  );

  return result_id;
end;
$$;

alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.job_titles enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_role_assignments enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (auth.uid() = id or public.is_membership_admin());

create policy profiles_update_self_contact
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy organization_select_approved
on public.departments for select to authenticated
using (public.is_approved_member());

create policy positions_select_approved
on public.positions for select to authenticated
using (public.is_approved_member());

create policy job_titles_select_approved
on public.job_titles for select to authenticated
using (public.is_approved_member());

create policy roles_select_approved
on public.roles for select to authenticated
using (public.is_approved_member());

create policy role_assignments_select_self_or_admin
on public.user_role_assignments for select to authenticated
using (user_id = auth.uid() or public.is_membership_admin());

create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (public.is_membership_admin());

revoke all on table public.departments from anon, authenticated;
revoke all on table public.positions from anon, authenticated;
revoke all on table public.job_titles from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.user_role_assignments from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select on table public.departments to authenticated;
grant select on table public.positions to authenticated;
grant select on table public.job_titles to authenticated;
grant select on table public.profiles to authenticated;
grant update (name, phone) on table public.profiles to authenticated;
grant select on table public.roles to authenticated;
grant select on table public.user_role_assignments to authenticated;
grant select on table public.audit_logs to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(text) from public, anon;
revoke all on function public.is_approved_member() from public, anon;
revoke all on function public.is_membership_admin() from public, anon;
revoke all on function public.get_signup_options() from public;
revoke all on function public.approve_membership(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.reject_membership(uuid, text) from public, anon;
revoke all on function public.upsert_organization_item(text, uuid, text, text, uuid, integer, boolean) from public, anon;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_approved_member() to authenticated;
grant execute on function public.is_membership_admin() to authenticated;
grant execute on function public.get_signup_options() to anon, authenticated;
grant execute on function public.approve_membership(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.reject_membership(uuid, text) to authenticated;
grant execute on function public.upsert_organization_item(text, uuid, text, text, uuid, integer, boolean) to authenticated;

commit;
