-- 후속 버전이 이미 쓰이고 있는 구버전 함수를 지운다.
--
-- 여섯 개 모두 (1) 앱 소스 어디에서도 호출하지 않고, (2) 다른 함수 본문·트리거·
-- RLS 정책 어디에서도 참조하지 않으며, (3) 엣지 함수 4개도 부르지 않는다.
-- 그런데 전부 SECURITY DEFINER 라 로그인한 직원 누구나 호출할 수 있었다.
-- 아무도 안 쓰는 권한 함수는 감사되지 않는 입구일 뿐이다.
--
--   submit_approval_document        → submit_approval_document_v2 사용중
--   recall_approval_document        → recall_approval_document_v2 사용중
--   process_signed_approval_action  → process_signed_approval_action_v2 사용중
--   save_approval_comment           → add_approval_comment 사용중
--   save_approval_references        → set_approval_references 사용중
--   mark_notification_read          → mark_groupware_notification_read 사용중
--
-- 조사 과정에서 register_inline_board_image / register_signup_profile_photo /
-- set_profile_photo 도 후보에 올랐으나, 엣지 함수(board-image-upload,
-- profile-photo-upload)가 호출하고 있어 제외했다. 소스 트리만 보고 판단했다면
-- 게시판 이미지 업로드와 프로필 사진이 죽었을 것이다.
--
-- 적용 후 확인: 결재자 결재함 3행, 문서 열람권한 true, 결재동작 조회 true.

drop function if exists public.submit_approval_document(uuid);
drop function if exists public.recall_approval_document(uuid, text);
drop function if exists public.process_signed_approval_action(uuid, uuid, text, text, uuid);
drop function if exists public.save_approval_comment(uuid, text, boolean);
drop function if exists public.save_approval_references(uuid, jsonb);
drop function if exists public.mark_notification_read(uuid);
