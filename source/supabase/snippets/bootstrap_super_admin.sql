-- Supabase SQL Editor에서 최초 최고 관리자 1회 부트스트랩에만 사용합니다.
-- 아래 placeholder를 실제 가입 이메일로 바꾼 뒤 관리자 권한으로 직접 실행하세요.
-- 이 SQL은 Data API/RPC로 노출되지 않습니다.

do $$
declare
  bootstrap_email text := 'FIRST_ADMIN_EMAIL@example.com';
  bootstrap_user_id uuid;
  before_profile public.profiles;
  after_profile public.profiles;
begin
  select id into bootstrap_user_id
  from auth.users
  where lower(email) = lower(bootstrap_email);

  if bootstrap_user_id is null then
    raise exception '가입된 사용자를 찾을 수 없습니다: %', bootstrap_email;
  end if;

  select * into before_profile
  from public.profiles
  where id = bootstrap_user_id
  for update;

  if before_profile.id is null then
    raise exception '가입 프로필을 찾을 수 없습니다: %', bootstrap_user_id;
  end if;

  update public.profiles
  set membership_status = 'approved',
      approved_at = now(),
      approved_by = bootstrap_user_id,
      rejection_reason = null,
      locked_at = null,
      resigned_at = null,
      employment_status = 'active',
      preferred_start_role = 'super_admin'
  where id = bootstrap_user_id
  returning * into after_profile;

  insert into public.user_role_assignments (user_id, role_code, assigned_by, is_active, revoked_at)
  values
    (bootstrap_user_id, 'super_admin', bootstrap_user_id, true, null),
    (bootstrap_user_id, 'employee', bootstrap_user_id, true, null)
  on conflict (user_id, role_code) do update
  set is_active=true,revoked_at=null,updated_at=now();

  insert into public.user_active_roles(user_id,active_role_code,updated_at)
  values(bootstrap_user_id,'super_admin',now())
  on conflict(user_id) do update set active_role_code='super_admin',updated_at=now();

  insert into public.audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    before_data,
    after_data,
    metadata
  ) values (
    bootstrap_user_id,
    'membership.bootstrap_super_admin',
    'profile',
    bootstrap_user_id::text,
    to_jsonb(before_profile) - 'phone',
    to_jsonb(after_profile) - 'phone',
    jsonb_build_object('method', 'manual_sql_editor')
  );
end;
$$;
