begin;

alter table public.user_role_assignments
  add column if not exists is_active boolean not null default true,
  add column if not exists revoked_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists preferred_name text,
  add column if not exists employee_number text,
  add column if not exists hire_date date,
  add column if not exists company_email text,
  add column if not exists mobile_phone text,
  add column if not exists office_phone text,
  add column if not exists extension_number text,
  add column if not exists employment_status text not null default 'active',
  add column if not exists work_location text,
  add column if not exists introduction text,
  add column if not exists profile_photo_path text,
  add column if not exists preferred_start_role text references public.roles(code) on delete set null,
  add column if not exists requested_hire_date date,
  add column if not exists requested_employee_number text,
  add column if not exists organization_request_note text,
  add column if not exists signup_photo_token_hash text,
  add column if not exists signup_photo_token_expires_at timestamptz;

update public.profiles
set full_name = coalesce(nullif(btrim(full_name), ''), name),
    company_email = coalesce(nullif(btrim(company_email), ''), email),
    mobile_phone = coalesce(nullif(btrim(mobile_phone), ''), phone);

alter table public.profiles
  alter column full_name set not null,
  add constraint profiles_full_name_length check (char_length(full_name) between 1 and 120),
  add constraint profiles_preferred_name_length check (preferred_name is null or char_length(preferred_name) <= 120),
  add constraint profiles_employee_number_length check (employee_number is null or char_length(employee_number) <= 60),
  add constraint profiles_company_email_length check (company_email is null or char_length(company_email) <= 320),
  add constraint profiles_mobile_phone_length check (mobile_phone is null or char_length(mobile_phone) <= 40),
  add constraint profiles_office_phone_length check (office_phone is null or char_length(office_phone) <= 40),
  add constraint profiles_extension_number_length check (extension_number is null or char_length(extension_number) <= 20),
  add constraint profiles_employment_status_allowed check (employment_status in ('active', 'leave', 'resigned')),
  add constraint profiles_work_location_length check (work_location is null or char_length(work_location) <= 160),
  add constraint profiles_introduction_length check (introduction is null or char_length(introduction) <= 300),
  add constraint profiles_requested_employee_number_length check (requested_employee_number is null or char_length(requested_employee_number) <= 60),
  add constraint profiles_organization_request_note_length check (organization_request_note is null or char_length(organization_request_note) <= 500);

create unique index if not exists profiles_employee_number_unique
on public.profiles(lower(employee_number)) where employee_number is not null;

create table if not exists public.user_active_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_role_code text not null references public.roles(code) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_photo_files (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  uploaded_by uuid references public.profiles(id) on delete set null,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'cleanup_candidate')),
  created_at timestamptz not null default now(),
  replaced_at timestamptz
);

create index if not exists profile_photo_files_profile_idx
on public.profile_photo_files(profile_id, lifecycle_status, created_at desc);

create trigger user_role_assignments_set_updated_at
before update on public.user_role_assignments
for each row execute function public.set_updated_at();

insert into public.user_role_assignments(user_id, role_code, assigned_by, is_active)
select p.id, 'employee', p.approved_by, true
from public.profiles p
where p.membership_status = 'approved'
on conflict(user_id, role_code) do update
set is_active = true, revoked_at = null, updated_at = now();

insert into public.user_active_roles(user_id, active_role_code)
select p.id,
       coalesce(
         (select ura.role_code
          from public.user_role_assignments ura
          join public.roles r on r.code = ura.role_code
          where ura.user_id = p.id and ura.is_active and ura.revoked_at is null
          order by r.sort_order
          limit 1),
         'employee'
       )
from public.profiles p
where p.membership_status = 'approved'
on conflict(user_id) do nothing;

update public.profiles p
set preferred_start_role = ar.active_role_code
from public.user_active_roles ar
where ar.user_id = p.id and p.preferred_start_role is null;

create or replace function public.user_has_assigned_role(p_user_id uuid, p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists(
    select 1 from public.user_role_assignments ura
    where ura.user_id = p_user_id
      and ura.role_code = p_role_code
      and ura.is_active
      and ura.revoked_at is null
  );
$$;

create or replace function public.get_user_active_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select ar.active_role_code
  from public.user_active_roles ar
  join public.user_role_assignments ura
    on ura.user_id = ar.user_id
   and ura.role_code = ar.active_role_code
   and ura.is_active
   and ura.revoked_at is null
  join public.profiles p on p.id = ar.user_id
  where ar.user_id = p_user_id
    and p.membership_status = 'approved'
    and p.employment_status <> 'resigned';
$$;

create or replace function public.user_has_active_role(p_user_id uuid, p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.get_user_active_role(p_user_id) = p_role_code;
$$;

create or replace function public.has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null and public.user_has_active_role(auth.uid(), requested_role);
$$;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.membership_status='approved'
      and p.employment_status<>'resigned'
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

create or replace function public.get_my_effective_access_context()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'full_name', p.full_name,
      'preferred_name', p.preferred_name,
      'display_name', coalesce(nullif(p.preferred_name, ''), p.full_name, p.name),
      'email', p.email,
      'company_email', p.company_email,
      'phone', p.phone,
      'mobile_phone', p.mobile_phone,
      'office_phone', p.office_phone,
      'extension_number', p.extension_number,
      'employee_number', p.employee_number,
      'hire_date', p.hire_date,
      'employment_status', p.employment_status,
      'work_location', p.work_location,
      'introduction', p.introduction,
      'profile_photo_path', p.profile_photo_path,
      'membership_status', p.membership_status,
      'department_id', p.department_id,
      'department_name', d.name,
      'position_id', p.position_id,
      'position_name', pos.name,
      'job_title_id', p.job_title_id,
      'job_title_name', jt.name,
      'preferred_start_role', p.preferred_start_role,
      'rejection_reason', p.rejection_reason,
      'approved_at', p.approved_at,
      'locked_at', p.locked_at,
      'resigned_at', p.resigned_at,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name, 'sort_order', r.sort_order) order by r.sort_order)
      from public.user_role_assignments ura
      join public.roles r on r.code = ura.role_code
      where ura.user_id = p.id and ura.is_active and ura.revoked_at is null
    ), '[]'::jsonb),
    'active_role', public.get_user_active_role(p.id)
  )
  from public.profiles p
  left join public.departments d on d.id = p.department_id
  left join public.positions pos on pos.id = p.position_id
  left join public.job_titles jt on jt.id = p.job_title_id
  where p.id = auth.uid();
$$;

create or replace function public.set_my_active_role(p_role_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_previous text;
  v_role_name text;
begin
  if not exists(
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.membership_status = 'approved'
      and p.employment_status <> 'resigned'
  ) then
    raise exception 'active_approved_member_required' using errcode = '42501';
  end if;

  if not public.user_has_assigned_role(auth.uid(), p_role_code) then
    raise exception 'role_not_assigned' using errcode = '42501';
  end if;

  select public.get_user_active_role(auth.uid()) into v_previous;
  select name into v_role_name from public.roles where code = p_role_code;
  if v_role_name is null then raise exception 'invalid_role' using errcode = '22023'; end if;
  if v_previous = p_role_code then return public.get_my_effective_access_context(); end if;

  insert into public.user_active_roles(user_id, active_role_code, updated_at)
  values(auth.uid(), p_role_code, now())
  on conflict(user_id) do update
  set active_role_code = excluded.active_role_code, updated_at = now();

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, before_data, after_data, metadata)
  values(
    auth.uid(),
    case
      when p_role_code in ('super_admin', 'admin') then 'role.admin_entered'
      when v_previous in ('super_admin', 'admin') then 'role.employee_returned'
      else 'role.active_changed'
    end,
    'profile',
    auth.uid()::text,
    jsonb_build_object('active_role', v_previous),
    jsonb_build_object('active_role', p_role_code),
    jsonb_build_object('role_name', v_role_name)
  );

  return public.get_my_effective_access_context();
end;
$$;

create or replace function public.dashboard_target_matches(p_target_type text, p_target_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select case p_target_type
    when 'all' then true
    when 'user' then p_target_id = p_user_id::text
    when 'role' then public.user_has_active_role(p_user_id, p_target_id)
    when 'department' then exists(select 1 from public.profiles where id=p_user_id and department_id::text=p_target_id)
    when 'position' then exists(select 1 from public.profiles where id=p_user_id and position_id::text=p_target_id)
    when 'job_title' then exists(select 1 from public.profiles where id=p_user_id and job_title_id::text=p_target_id)
    else false end;
$$;

create or replace function public.board_target_matches(p_board_id uuid, p_target_type text, p_target_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select case p_target_type
    when 'all' then true
    when 'user' then p_target_id=p_user_id::text
    when 'role' then public.user_has_active_role(p_user_id, p_target_id)
    when 'department' then exists(select 1 from public.profiles where id=p_user_id and department_id::text=p_target_id)
    when 'position' then exists(select 1 from public.profiles where id=p_user_id and position_id::text=p_target_id)
    when 'job_title' then exists(select 1 from public.profiles where id=p_user_id and job_title_id::text=p_target_id)
    when 'board_manager' then exists(select 1 from public.board_managers where board_id=p_board_id and user_id=p_user_id)
    when 'author' then true
    else false end;
$$;

create or replace function public.evaluate_board_access(p_board_id uuid, p_action text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(
    select 1 from public.profiles
    where id=p_user_id and membership_status='approved' and employment_status <> 'resigned'
  ) and (
    public.user_has_active_role(p_user_id, 'super_admin') or (
      exists(select 1 from public.boards where id=p_board_id and is_active and archived_at is null)
      and exists(select 1 from public.board_permission_rules r where r.board_id=p_board_id and r.action=p_action and r.effect='allow' and public.board_target_matches(p_board_id,r.target_type,r.target_id,p_user_id))
      and not exists(select 1 from public.board_permission_rules r where r.board_id=p_board_id and r.action=p_action and r.effect='deny' and public.board_target_matches(p_board_id,r.target_type,r.target_id,p_user_id))
    )
  );
$$;

create or replace function public.update_my_employee_profile(
  p_preferred_name text,
  p_mobile_phone text,
  p_office_phone text,
  p_extension_number text,
  p_introduction text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_changed_fields text[] := array[]::text[];
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  if char_length(coalesce(p_preferred_name,'')) > 120
    or char_length(coalesce(p_mobile_phone,'')) > 40
    or char_length(coalesce(p_office_phone,'')) > 40
    or char_length(coalesce(p_extension_number,'')) > 20
    or char_length(coalesce(p_introduction,'')) > 300 then
    raise exception 'profile_value_too_long' using errcode='22023';
  end if;

  if (select preferred_name is distinct from nullif(btrim(p_preferred_name),'') from public.profiles where id=auth.uid()) then v_changed_fields := array_append(v_changed_fields,'preferred_name'); end if;
  if (select mobile_phone is distinct from nullif(btrim(p_mobile_phone),'') from public.profiles where id=auth.uid()) then v_changed_fields := array_append(v_changed_fields,'mobile_phone'); end if;
  if (select office_phone is distinct from nullif(btrim(p_office_phone),'') from public.profiles where id=auth.uid()) then v_changed_fields := array_append(v_changed_fields,'office_phone'); end if;
  if (select extension_number is distinct from nullif(btrim(p_extension_number),'') from public.profiles where id=auth.uid()) then v_changed_fields := array_append(v_changed_fields,'extension_number'); end if;
  if (select introduction is distinct from nullif(btrim(p_introduction),'') from public.profiles where id=auth.uid()) then v_changed_fields := array_append(v_changed_fields,'introduction'); end if;

  update public.profiles
  set preferred_name=nullif(btrim(p_preferred_name),''),
      mobile_phone=nullif(btrim(p_mobile_phone),''),
      phone=nullif(btrim(p_mobile_phone),''),
      office_phone=nullif(btrim(p_office_phone),''),
      extension_number=nullif(btrim(p_extension_number),''),
      introduction=nullif(btrim(p_introduction),'')
  where id=auth.uid();

  if cardinality(v_changed_fields) > 0 then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
    values(auth.uid(),'profile.self_updated','profile',auth.uid()::text,jsonb_build_object('changed_fields',v_changed_fields));
  end if;
  return public.get_my_effective_access_context();
end;
$$;

create or replace function public.get_employee_profile_catalog(p_search text default null, p_department_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'full_name',p.full_name,'preferred_name',p.preferred_name,'display_name',coalesce(nullif(p.preferred_name,''),p.full_name,p.name),
        'employee_number',p.employee_number,'company_email',p.company_email,'mobile_phone',p.mobile_phone,'office_phone',p.office_phone,
        'extension_number',p.extension_number,'hire_date',p.hire_date,'employment_status',p.employment_status,'work_location',p.work_location,
        'introduction',p.introduction,'profile_photo_path',p.profile_photo_path,'membership_status',p.membership_status,
        'department_id',p.department_id,'department_name',d.name,'position_id',p.position_id,'position_name',pos.name,
        'job_title_id',p.job_title_id,'job_title_name',jt.name,'preferred_start_role',p.preferred_start_role,
        'active_role',public.get_user_active_role(p.id),
        'roles',coalesce((select jsonb_agg(ura.role_code order by r.sort_order) from public.user_role_assignments ura join public.roles r on r.code=ura.role_code where ura.user_id=p.id and ura.is_active and ura.revoked_at is null),'[]'::jsonb)
      ) order by p.full_name)
      from public.profiles p
      left join public.departments d on d.id=p.department_id
      left join public.positions pos on pos.id=p.position_id
      left join public.job_titles jt on jt.id=p.job_title_id
      where p.membership_status='approved'
        and (p_department_id is null or p.department_id=p_department_id)
        and (coalesce(btrim(p_search),'')='' or p.full_name ilike '%'||btrim(p_search)||'%' or p.employee_number ilike '%'||btrim(p_search)||'%' or p.company_email ilike '%'||btrim(p_search)||'%')
    ),'[]'::jsonb),
    'recent_changes',coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'target_id',a.target_id,'metadata',a.metadata,'created_at',a.created_at) order by a.created_at desc)
      from (select * from public.audit_logs where target_type='profile' order by created_at desc limit 100) a
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.update_employee_profile(
  p_user_id uuid,
  p_full_name text,
  p_employee_number text,
  p_department_id uuid,
  p_position_id uuid,
  p_job_title_id uuid,
  p_hire_date date,
  p_company_email text,
  p_mobile_phone text,
  p_office_phone text,
  p_extension_number text,
  p_employment_status text,
  p_work_location text,
  p_roles text[],
  p_preferred_start_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_before public.profiles;
  v_before_roles text[];
  v_requested_roles text[];
  v_removed_roles text[];
  v_added_roles text[];
  v_current_active text;
  v_fallback text;
  v_changed_fields text[] := array[]::text[];
  v_role text;
  v_super_admin_count integer;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  select * into v_before from public.profiles where id=p_user_id and membership_status='approved' for update;
  if not found then raise exception 'approved_profile_not_found' using errcode='P0002'; end if;

  select coalesce(array_agg(ura.role_code order by r.sort_order),array[]::text[])
  into v_before_roles
  from public.user_role_assignments ura join public.roles r on r.code=ura.role_code
  where ura.user_id=p_user_id and ura.is_active and ura.revoked_at is null;

  select array_agg(distinct requested.role_code) into v_requested_roles
  from unnest(coalesce(p_roles,array[]::text[]) || array['employee']) as requested(role_code)
  where requested.role_code in (select code from public.roles);
  if v_requested_roles is null or cardinality(v_requested_roles)=0 then v_requested_roles:=array['employee']; end if;
  if exists(select 1 from unnest(coalesce(p_roles,array[]::text[])) as requested(role_code) where requested.role_code not in (select code from public.roles)) then
    raise exception 'invalid_role' using errcode='22023';
  end if;
  if (
    ('super_admin'=any(v_before_roles)) is distinct from ('super_admin'=any(v_requested_roles))
    or ('admin'=any(v_before_roles)) is distinct from ('admin'=any(v_requested_roles))
  ) and not public.has_role('super_admin') then
    raise exception 'super_admin_required_for_admin_role' using errcode='42501';
  end if;
  if p_preferred_start_role is null or not p_preferred_start_role=any(v_requested_roles) then
    raise exception 'preferred_role_must_be_assigned' using errcode='22023';
  end if;
  if p_employment_status not in ('active','leave','resigned') then raise exception 'invalid_employment_status' using errcode='22023'; end if;
  if nullif(btrim(p_full_name),'') is null then raise exception 'full_name_required' using errcode='22023'; end if;
  if not exists(select 1 from public.departments where id=p_department_id and is_active and archived_at is null)
    or not exists(select 1 from public.positions where id=p_position_id and is_active)
    or not exists(select 1 from public.job_titles where id=p_job_title_id and is_active) then
    raise exception 'active_organization_values_required' using errcode='22023';
  end if;

  if 'super_admin'=any(v_before_roles)
    and (not ('super_admin'=any(v_requested_roles)) or p_employment_status='resigned') then
    perform pg_advisory_xact_lock(pg_catalog.hashtextextended('last_super_admin_guard',0));
    select count(*) into v_super_admin_count
    from public.user_role_assignments ura
    join public.profiles protected_profile on protected_profile.id=ura.user_id
    where ura.role_code='super_admin'
      and ura.user_id<>p_user_id
      and ura.is_active
      and ura.revoked_at is null
      and protected_profile.membership_status='approved'
      and protected_profile.employment_status<>'resigned';
    if v_super_admin_count < 1 then
      insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
      values(auth.uid(),'role.last_super_admin_removal_blocked','profile',p_user_id::text,jsonb_build_object('attempted_change',case when p_employment_status='resigned' then 'employment_resigned' else 'role_revocation' end));
      return jsonb_build_object('ok',false,'code','last_super_admin_protected');
    end if;
  end if;

  if v_before.full_name is distinct from nullif(btrim(p_full_name),'') then v_changed_fields:=array_append(v_changed_fields,'full_name'); end if;
  if v_before.employee_number is distinct from nullif(btrim(p_employee_number),'') then v_changed_fields:=array_append(v_changed_fields,'employee_number'); end if;
  if v_before.department_id is distinct from p_department_id then v_changed_fields:=array_append(v_changed_fields,'department_id'); end if;
  if v_before.position_id is distinct from p_position_id then v_changed_fields:=array_append(v_changed_fields,'position_id'); end if;
  if v_before.job_title_id is distinct from p_job_title_id then v_changed_fields:=array_append(v_changed_fields,'job_title_id'); end if;
  if v_before.hire_date is distinct from p_hire_date then v_changed_fields:=array_append(v_changed_fields,'hire_date'); end if;
  if v_before.company_email is distinct from nullif(btrim(p_company_email),'') then v_changed_fields:=array_append(v_changed_fields,'company_email'); end if;
  if v_before.mobile_phone is distinct from nullif(btrim(p_mobile_phone),'') then v_changed_fields:=array_append(v_changed_fields,'mobile_phone'); end if;
  if v_before.office_phone is distinct from nullif(btrim(p_office_phone),'') then v_changed_fields:=array_append(v_changed_fields,'office_phone'); end if;
  if v_before.extension_number is distinct from nullif(btrim(p_extension_number),'') then v_changed_fields:=array_append(v_changed_fields,'extension_number'); end if;
  if v_before.employment_status is distinct from p_employment_status then v_changed_fields:=array_append(v_changed_fields,'employment_status'); end if;
  if v_before.work_location is distinct from nullif(btrim(p_work_location),'') then v_changed_fields:=array_append(v_changed_fields,'work_location'); end if;

  update public.profiles
  set full_name=nullif(btrim(p_full_name),''), name=nullif(btrim(p_full_name),''),
      employee_number=nullif(btrim(p_employee_number),''), department_id=p_department_id, position_id=p_position_id, job_title_id=p_job_title_id,
      hire_date=p_hire_date, company_email=nullif(btrim(p_company_email),''), mobile_phone=nullif(btrim(p_mobile_phone),''),
      phone=nullif(btrim(p_mobile_phone),''), office_phone=nullif(btrim(p_office_phone),''), extension_number=nullif(btrim(p_extension_number),''),
      employment_status=p_employment_status, work_location=nullif(btrim(p_work_location),''), preferred_start_role=p_preferred_start_role,
      resigned_at=case when p_employment_status='resigned' then coalesce(resigned_at,now()) else null end
  where id=p_user_id;

  foreach v_role in array v_requested_roles loop
    insert into public.user_role_assignments(user_id,role_code,assigned_by,is_active,revoked_at,assigned_at,updated_at)
    values(p_user_id,v_role,auth.uid(),true,null,now(),now())
    on conflict(user_id,role_code) do update
    set is_active=true,revoked_at=null,assigned_by=auth.uid(),assigned_at=case when user_role_assignments.is_active then user_role_assignments.assigned_at else now() end,updated_at=now();
  end loop;
  update public.user_role_assignments
  set is_active=false,revoked_at=now(),updated_at=now()
  where user_id=p_user_id and is_active and not(role_code=any(v_requested_roles));

  select array(select unnest(v_requested_roles) except select unnest(v_before_roles)) into v_added_roles;
  select array(select unnest(v_before_roles) except select unnest(v_requested_roles)) into v_removed_roles;
  if cardinality(v_added_roles)>0 then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
    values(auth.uid(),'role.assigned','profile',p_user_id::text,jsonb_build_object('roles',v_added_roles));
  end if;
  if cardinality(v_removed_roles)>0 then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
    values(auth.uid(),'role.revoked','profile',p_user_id::text,jsonb_build_object('roles',v_removed_roles));
  end if;

  select public.get_user_active_role(p_user_id) into v_current_active;
  if v_current_active is null or not(v_current_active=any(v_requested_roles)) then
    v_fallback:=p_preferred_start_role;
    insert into public.user_active_roles(user_id,active_role_code,updated_at)
    values(p_user_id,v_fallback,now()) on conflict(user_id) do update set active_role_code=excluded.active_role_code,updated_at=now();
  end if;

  if cardinality(v_changed_fields)>0 then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
    values(auth.uid(),'profile.admin_updated','profile',p_user_id::text,jsonb_build_object('changed_fields',v_changed_fields));
  end if;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'active_role',public.get_user_active_role(p_user_id));
end;
$$;

create or replace function public.set_profile_photo(
  p_user_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_previous text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_user_id<>auth.uid() and not public.is_membership_admin() then raise exception 'profile_photo_admin_required' using errcode='42501'; end if;
  if split_part(p_storage_path,'/',1)<>p_user_id::text
    or p_mime_type not in ('image/jpeg','image/png','image/webp')
    or p_file_size<1 or p_file_size>5242880
    or not exists(select 1 from storage.objects o where o.bucket_id='groupware-profile-photos' and o.name=p_storage_path) then
    raise exception 'invalid_profile_photo' using errcode='22023';
  end if;
  select profile_photo_path into v_previous
  from public.profiles
  where id=p_user_id and membership_status='approved' and employment_status<>'resigned'
  for update;
  if not found then raise exception 'profile_not_found' using errcode='P0002'; end if;
  update public.profile_photo_files set lifecycle_status='cleanup_candidate',replaced_at=now()
  where profile_id=p_user_id and lifecycle_status='active';
  insert into public.profile_photo_files(profile_id,storage_path,mime_type,file_size,uploaded_by)
  values(p_user_id,p_storage_path,p_mime_type,p_file_size,auth.uid());
  update public.profiles set profile_photo_path=p_storage_path where id=p_user_id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
  values(auth.uid(),case when p_user_id=auth.uid() then 'profile.photo_changed' else 'profile.photo_admin_changed' end,'profile',p_user_id::text,jsonb_build_object('previous_photo_replaced',v_previous is not null));
end;
$$;

create or replace function public.register_signup_profile_photo(
  p_user_id uuid,
  p_token_hash text,
  p_storage_path text,
  p_mime_type text,
  p_file_size bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.membership_status='pending' and p.signup_photo_token_hash=p_token_hash and p.signup_photo_token_expires_at>now())
    or split_part(p_storage_path,'/',1)<>p_user_id::text
    or p_mime_type not in ('image/jpeg','image/png','image/webp')
    or p_file_size<1 or p_file_size>5242880
    or not exists(select 1 from storage.objects o where o.bucket_id='groupware-profile-photos' and o.name=p_storage_path) then
    raise exception 'invalid_signup_profile_photo' using errcode='42501';
  end if;
  insert into public.profile_photo_files(profile_id,storage_path,mime_type,file_size,uploaded_by)
  values(p_user_id,p_storage_path,p_mime_type,p_file_size,null);
  update public.profiles set profile_photo_path=p_storage_path,signup_photo_token_hash=null,signup_photo_token_expires_at=null where id=p_user_id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
  values(null,'profile.signup_photo_uploaded','profile',p_user_id::text,jsonb_build_object('source','signup'));
end;
$$;

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
  requested_hire date;
  photo_token text;
begin
  select id into requested_department from public.departments where id::text=coalesce(new.raw_user_meta_data->>'requested_department_id','') and is_active;
  select id into requested_position from public.positions where id::text=coalesce(new.raw_user_meta_data->>'requested_position_id','') and is_active;
  select id into requested_job_title from public.job_titles where id::text=coalesce(new.raw_user_meta_data->>'requested_job_title_id','') and is_active;
  begin requested_hire:=nullif(new.raw_user_meta_data->>'requested_hire_date','')::date; exception when others then requested_hire:=null; end;
  photo_token:=nullif(new.raw_user_meta_data->>'profile_photo_upload_token','');
  insert into public.profiles(
    id,name,full_name,email,company_email,phone,mobile_phone,membership_status,
    requested_department_id,requested_position_id,requested_job_title_id,requested_hire_date,requested_employee_number,
    organization_request_note,signup_photo_token_hash,signup_photo_token_expires_at
  ) values(
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1)),120),
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1)),120),
    coalesce(new.email,''),coalesce(new.email,''),left(nullif(btrim(new.raw_user_meta_data->>'phone'),''),40),left(nullif(btrim(new.raw_user_meta_data->>'phone'),''),40),'pending',
    requested_department,requested_position,requested_job_title,requested_hire,left(nullif(btrim(new.raw_user_meta_data->>'requested_employee_number'),''),60),
    left(nullif(btrim(new.raw_user_meta_data->>'organization_request_note'),''),500),
    case when photo_token is null then null else encode(extensions.digest(photo_token,'sha256'),'hex') end,
    case when photo_token is null then null else now()+interval '24 hours' end
  ) on conflict(id) do nothing;
  return new;
exception when others then
  raise log 'handle_new_auth_user failed for user %: %',new.id,sqlerrm;
  raise;
end;
$$;

create or replace function public.approve_membership(
  p_user_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_job_title_id uuid,
  p_role_code text,
  p_hire_date date,
  p_employee_number text
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare previous_profile public.profiles; approved_profile public.profiles;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  if p_role_code not in (select code from public.roles) then raise exception 'invalid_role' using errcode='22023'; end if;
  if p_role_code in ('super_admin','admin') and not public.has_role('super_admin') then raise exception 'super_admin_required_for_admin_role' using errcode='42501'; end if;
  if not exists(select 1 from public.departments where id=p_department_id and is_active and archived_at is null)
    or not exists(select 1 from public.positions where id=p_position_id and is_active)
    or not exists(select 1 from public.job_titles where id=p_job_title_id and is_active) then raise exception 'active_organization_values_required' using errcode='22023'; end if;
  select * into previous_profile from public.profiles where id=p_user_id for update;
  if not found then raise exception 'profile_not_found' using errcode='P0002'; end if;
  if previous_profile.membership_status<>'pending' then raise exception 'membership_not_pending' using errcode='P0001'; end if;
  if coalesce(p_hire_date,previous_profile.requested_hire_date) is null
    or coalesce(nullif(btrim(p_employee_number),''),previous_profile.requested_employee_number) is null then
    raise exception 'hire_date_and_employee_number_required' using errcode='22023';
  end if;
  update public.profiles set membership_status='approved',department_id=p_department_id,position_id=p_position_id,job_title_id=p_job_title_id,
    hire_date=coalesce(p_hire_date,requested_hire_date),employee_number=coalesce(nullif(btrim(p_employee_number),''),requested_employee_number),
    employment_status='active',approved_at=now(),approved_by=auth.uid(),rejection_reason=null,locked_at=null,resigned_at=null,
    preferred_start_role=p_role_code where id=p_user_id returning * into approved_profile;
  insert into public.user_role_assignments(user_id,role_code,assigned_by,is_active) values(p_user_id,'employee',auth.uid(),true)
    on conflict(user_id,role_code) do update set is_active=true,revoked_at=null,updated_at=now();
  insert into public.user_role_assignments(user_id,role_code,assigned_by,is_active) values(p_user_id,p_role_code,auth.uid(),true)
    on conflict(user_id,role_code) do update set is_active=true,revoked_at=null,updated_at=now();
  insert into public.user_active_roles(user_id,active_role_code,updated_at) values(p_user_id,p_role_code,now())
    on conflict(user_id) do update set active_role_code=excluded.active_role_code,updated_at=now();
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data,metadata)
  values(auth.uid(),'membership.approved','profile',p_user_id::text,jsonb_build_object('membership_status',previous_profile.membership_status),jsonb_build_object('membership_status','approved'),jsonb_build_object('role_code',p_role_code));
  return approved_profile;
end;
$$;

create or replace function public.approve_membership(
  p_user_id uuid,
  p_department_id uuid,
  p_position_id uuid,
  p_job_title_id uuid,
  p_role_code text
)
returns public.profiles
language sql
security definer
set search_path = pg_catalog
as $$
  select public.approve_membership(p_user_id,p_department_id,p_position_id,p_job_title_id,p_role_code,null,null);
$$;

alter table public.user_active_roles enable row level security;
alter table public.profile_photo_files enable row level security;

create policy user_active_roles_select_self_or_admin on public.user_active_roles for select to authenticated
using(user_id=auth.uid() or public.is_membership_admin());

create policy profile_photo_files_select_self_or_admin on public.profile_photo_files for select to authenticated
using(profile_id=auth.uid() or public.is_membership_admin());

revoke all on table public.user_active_roles,public.profile_photo_files from anon,authenticated;
grant select on table public.user_active_roles,public.profile_photo_files to authenticated;
revoke update(name,phone) on table public.profiles from authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('groupware-profile-photos','groupware-profile-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

-- 인증 사용자의 Storage 직접 업로드는 허용하지 않는다. 실제 디코딩과 크기 검증을
-- 통과한 profile-photo-upload Edge Function만 service_role로 객체를 기록한다.

create policy profile_photo_storage_select on storage.objects for select to authenticated
using(
  bucket_id='groupware-profile-photos'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_membership_admin())
  and exists(select 1 from public.profile_photo_files f where f.storage_path=name and f.lifecycle_status='active')
);

revoke all on function public.user_has_assigned_role(uuid,text),public.get_user_active_role(uuid),public.user_has_active_role(uuid,text),
  public.get_my_effective_access_context(),public.set_my_active_role(text),public.update_my_employee_profile(text,text,text,text,text),
  public.get_employee_profile_catalog(text,uuid),public.update_employee_profile(uuid,text,text,uuid,uuid,uuid,date,text,text,text,text,text,text,text[],text),
  public.set_profile_photo(uuid,text,text,bigint),public.register_signup_profile_photo(uuid,text,text,text,bigint) from public,anon,authenticated;

grant execute on function public.get_my_effective_access_context(),public.set_my_active_role(text),public.update_my_employee_profile(text,text,text,text,text),
  public.get_employee_profile_catalog(text,uuid),public.update_employee_profile(uuid,text,text,uuid,uuid,uuid,date,text,text,text,text,text,text,text[],text),
  public.set_profile_photo(uuid,text,text,bigint) to authenticated;
grant execute on function public.register_signup_profile_photo(uuid,text,text,text,bigint) to service_role;

revoke all on function public.approve_membership(uuid,uuid,uuid,uuid,text,date,text) from public,anon;
grant execute on function public.approve_membership(uuid,uuid,uuid,uuid,text,date,text) to authenticated;

revoke all on function public.dashboard_target_matches(text,text,uuid),public.board_target_matches(uuid,text,text,uuid),public.evaluate_board_access(uuid,text,uuid) from public,anon,authenticated;

commit;
