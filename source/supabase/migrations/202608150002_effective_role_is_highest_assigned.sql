begin;

-- 활성 역할 전환을 없앤다.
--
-- 지금까지는 user_active_roles에 저장된 "활성 역할" 하나만 권한으로 인정해서,
-- 관리자 역할을 가진 사람도 전환하기 전에는 관리 기능이 막혔다. 사용자가 스스로
-- 역할을 바꿔가며 쓰는 구조 자체가 필요하지 않으므로, 권한을 "보유한 역할 중
-- 가장 높은 역할"로 고정한다. roles.sort_order는 값이 작을수록 상위 권한이다
-- (super_admin 10 → employee 50).
--
-- RLS 전반이 has_role() → user_has_active_role() → get_user_active_role()을 통해
-- 이 함수 하나를 거치므로, 여기만 바꾸면 화면에 보이는 메뉴와 서버가 허용하는
-- 작업이 어긋나지 않는다.
create or replace function public.get_user_active_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select ura.role_code
  from public.user_role_assignments ura
  join public.roles r on r.code = ura.role_code
  join public.profiles p on p.id = ura.user_id
  where ura.user_id = p_user_id
    and ura.is_active
    and ura.revoked_at is null
    and p.membership_status = 'approved'
    and p.employment_status <> 'resigned'
  order by r.sort_order
  limit 1;
$$;

-- 저장된 활성 역할은 더 이상 권한 판단에 쓰이지 않는다. 남은 행이 현재 권한처럼
-- 오해되지 않도록 유효 역할과 맞춰 둔다. (테이블은 approve_membership 등 기존
-- 함수가 계속 기록하므로 삭제하지 않는다.)
update public.user_active_roles ar
set active_role_code = public.get_user_active_role(ar.user_id),
    updated_at = now()
where public.get_user_active_role(ar.user_id) is not null
  and ar.active_role_code is distinct from public.get_user_active_role(ar.user_id);

-- 역할 전환 진입점을 닫는다. 함수는 과거 감사 로그와의 참조를 위해 남겨 두되
-- 클라이언트에서는 호출할 수 없게 한다.
revoke execute on function public.set_my_active_role(text) from authenticated;

commit;
