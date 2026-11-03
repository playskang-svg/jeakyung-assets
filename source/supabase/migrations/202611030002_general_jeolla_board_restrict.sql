begin;

-- 2026-10-23에 일반업무 전라남북사업부 글 21건을 복사해 둔 숨은 게시판
-- general-jeolla(일반업무 · 전라남북사업부)가 남아 있다. 사이드바와 바로가기에는
-- 없지만 전체 검색·최근글·직접 주소로는 누구나 읽을 수 있어, 일반업무 탭에 건
-- 열람 제한(202611030001)이 이 사본으로 새어 나간다. 같은 세 사람에게만 연다.
-- 되돌리려면 아래 'all' 규칙을 다시 넣고 user 규칙을 지운다.
do $do$
declare
  target uuid;
  people integer;
begin
  select id into strict target from public.boards where slug='general-jeolla';
  select count(*) into people from public.profiles where name in ('강석기','염달성','신한나');
  if people <> 3 then raise exception 'expected 3 profiles, got %', people; end if;

  insert into public.board_permission_rules(board_id, action, target_type, target_id, effect)
  select r.board_id, r.action, 'user', p.id::text, 'allow'
  from public.board_permission_rules r
  cross join public.profiles p
  where r.board_id=target and r.target_type='all' and r.effect='allow'
    and p.name in ('강석기','염달성','신한나')
    and not exists(select 1 from public.board_permission_rules x
      where x.board_id=r.board_id and x.action=r.action and x.target_type='user' and x.target_id=p.id::text);

  delete from public.board_permission_rules
  where board_id=target and target_type='all' and effect='allow';
end
$do$;

commit;
