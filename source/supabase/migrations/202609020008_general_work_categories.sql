-- 일반업무는 "사업장별 업무 구분"인데 분류가 없어 구분할 방법이 없었다.
-- 업무보고와 같은 사업부 다섯으로 맞춘다. 두 게시판을 오갈 때 같은 이름이
-- 같은 순서로 나와야 헷갈리지 않는다.
--
-- manage_board 를 쓰지 않고 분류만 직접 넣는다. 그 함수는 권한 규칙과 관리자
-- 목록까지 통째로 갈아 끼우므로, 분류 하나 더하자고 부르면 넘기지 않은 것이
-- 조용히 지워진다.
insert into public.board_categories(board_id, name, code, sort_order, is_active)
select b.id, v.name, v.code, v.sort_order, true
from public.boards b
cross join (values
  ('광주본사사업부','gwangju-hq',0),
  ('전라남북사업부','jeolla',10),
  ('서울경기사업부','seoul-gyeonggi',20),
  ('경상남북사업부','gyeongsang',30),
  ('지입관리사업부','consignment',40)
) as v(name, code, sort_order)
where b.slug = 'general-work'
  and not exists (
    select 1 from public.board_categories c
    where c.board_id = b.id and c.code = v.code
  );
