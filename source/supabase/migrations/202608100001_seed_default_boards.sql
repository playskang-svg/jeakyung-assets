begin;

-- 지입관리업무 게시판 생성 (공지사항/사내게시판/업무는 이미 존재함)
-- 나머지 3개와 동일하게 '회사' 그룹, 통합게시판(free) 유형, 전체 사용자 열람/작성/댓글 허용으로 구성한다.
insert into public.boards (group_id, name, slug, description, board_type, sort_order, is_active)
select g.id, '지입관리업무', 'consignment-work', '지입 차량과 계약 관리 업무를 공유하는 게시판입니다.', 'free', 40, true
from public.board_groups g
where g.code = 'company'
  and not exists (select 1 from public.boards where slug = 'consignment-work');

insert into public.board_permission_rules (board_id, action, target_type, effect)
select b.id, action, 'all', 'allow'
from public.boards b
cross join (values
  ('sidebar_view'),('list_read'),('detail_read'),
  ('post_create'),('own_post_update'),('own_post_delete'),
  ('comment_create'),('own_comment_update'),('own_comment_delete'),
  ('attachment_view'),('attachment_download'),('attachment_upload')
) as actions(action)
where b.slug = 'consignment-work'
  and not exists (
    select 1 from public.board_permission_rules r where r.board_id = b.id
  );

commit;
