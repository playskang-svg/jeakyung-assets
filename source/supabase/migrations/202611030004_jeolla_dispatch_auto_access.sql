begin;

-- 일반업무 › 전라남북사업부에 제목에 '배차일보'가 들어간 글이 저장되면 자동으로
-- 강석기·염달성·신한나 전용(board_post_access)으로 잠근다. 2026-11-03 사용자 지시.
-- 글쓰기는 초안을 먼저 만들고(제목 없음) 저장 때 제목·분류를 채우므로 UPDATE 에도 건다.
-- 이름이 같은 사람이 새로 들어와도 열리지 않게 계정 id 로 고정한다.
-- shortcut: 제목에서 '배차일보'를 빼도 잠금은 풀리지 않는다. 풀 일이 생기면 board_post_access 에서 지운다.
create or replace function public.lock_jeolla_dispatch_post()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
begin
  if new.title like '%배차일보%'
     and exists(
       select 1 from public.board_categories c join public.boards b on b.id=c.board_id
       where c.id=new.category_id and b.slug='general-work' and c.name='전라남북사업부') then
    insert into public.board_post_access(post_id, user_id)
    select new.id, u.id from (values
      ('58530263-8e46-4fd3-b244-ceea4e7ca91f'::uuid),  -- 강석기
      ('e0ebd311-ee14-4b1f-80b4-a1cd586af3ab'::uuid),  -- 염달성
      ('a28bab09-7483-4969-9b71-b1a3bdcaca39'::uuid)   -- 신한나
    ) as u(id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.lock_jeolla_dispatch_post() from public, anon, authenticated;

drop trigger if exists lock_jeolla_dispatch_post on public.board_posts;
create trigger lock_jeolla_dispatch_post
after insert or update of title, category_id on public.board_posts
for each row execute function public.lock_jeolla_dispatch_post();

commit;
