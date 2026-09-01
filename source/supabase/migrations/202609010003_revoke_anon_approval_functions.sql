-- 결재 관련 SECURITY DEFINER 함수 3개에서 익명(anon) 실행 권한을 회수한다.
--
-- 왜:
--   이 셋은 row_security = off 로 RLS 를 통째로 우회한다. 지금도 유출은 없는데,
--   막고 있는 것이 함수 첫 줄의 is_approved_member() / auth.uid() is not null
--   검사 하나뿐이다. 안전이 그 한 줄에만 걸려 있는 상태가 위태롭다.
--
--   한편 이 함수들을 참조하는 RLS 정책 10개는 전부 {authenticated} 대상이라,
--   익명 실행 권한은 실제로 쓰이는 곳이 없다. Supabase 가 public 스키마 함수에
--   기본으로 부여한 권한이 그대로 남아 있었을 뿐이다.
--
--   그래서 회수한다. 나중에 누가 저 검사 줄을 건드려도 익명에게는 닿지 않는다.
--   authenticated 권한은 건드리지 않으므로 로그인 사용자 동작은 그대로다.
--
-- 적용 후 확인한 것:
--   [anon]          세 함수 모두 호출 자체가 차단(권한 없음)
--   [기안자]        can_view_approval_document = true
--   [결재 대기자]   get_my_approval_inbox = 3행 정상 반환

revoke execute on function public.can_view_approval_document(uuid) from anon;
revoke execute on function public.get_my_approval_inbox() from anon;
revoke execute on function public.has_active_approval_delegation(uuid, uuid) from anon;
