begin;

-- 게시판 권한은 게시판 단위라, 한 게시판 안의 분류(탭) 하나만 몇 사람에게
-- 여는 방법이 없었다. 일반업무의 '전라남북사업부' 탭을 강석기·염달성·신한나만
-- 열어 보게 하려고 분류별 열람자 목록을 둔다.
--
-- 규칙: 목록에 한 줄도 없는 분류는 지금처럼 게시판 권한만 따른다. 한 줄이라도
-- 있으면 그 사람들만 그 분류의 글을 목록·상세·검색·최근글·댓글·반응·첨부로
-- 볼 수 있다. 탭 자체는 모두에게 그대로 보인다.
create table if not exists public.board_category_access (
  category_id uuid not null references public.board_categories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, user_id)
);
-- 정의자 권한 함수만 읽는다. 정책을 두지 않아 직접 조회는 막힌다.
alter table public.board_category_access enable row level security;
revoke all on public.board_category_access from anon, authenticated;

create or replace function public.can_access_board_category(p_category_id uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog' as $$
  select p_category_id is null
    or not exists(select 1 from public.board_category_access a where a.category_id=p_category_id)
    or exists(select 1 from public.board_category_access a where a.category_id=p_category_id and a.user_id=auth.uid());
$$;
revoke all on function public.can_access_board_category(uuid) from public, anon;
grant execute on function public.can_access_board_category(uuid) to authenticated, service_role;

-- 글을 내보내는 함수마다 분류 검사를 한 줄씩 덧붙인다. 함수 본문을 통째로
-- 다시 적으면 운영에서 따로 고친 부분을 덮을 수 있어, 운영 정의를 읽어 정해진
-- 구절 뒤에만 붙인다. 구절이 정확히 한 번 나오지 않으면 전부 되돌린다.
do $do$
declare
  r record;
  def text;
  pat text;
  hits integer;
begin
  for r in select * from (values
    ('public.get_board_posts(text,text,uuid,integer,text)', $s$p.board_id=b.id and p.status='published' and p.deleted_at is null$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.get_board_posts(text,text,uuid,integer,text)', $s$total.board_id=b.id and total.status='published' and total.deleted_at is null$s$, $a$ and public.can_access_board_category(total.category_id)$a$),
    -- 잠긴 탭을 연 사람에게 "글 없음" 대신 권한 안내를 띄울 수 있게 알려 준다.
    ('public.get_board_posts(text,text,uuid,integer,text)', $s$'page',greatest(p_page,1),$s$, $a$'category_locked',not public.can_access_board_category(p_category),$a$),
    ('public.get_board_post(uuid)', $s$if p.id is null or not public.can_access_board(p.board_id,'detail_read')$s$, $a$ or not public.can_access_board_category(p.category_id)$a$),
    ('public.get_board_reactions(uuid)', $s$where p.id=p_post_id and p.status='published' and p.deleted_at is null$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.toggle_board_reaction(uuid,text)', $s$where p.id=p_post_id and p.status='published' and p.deleted_at is null$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.save_board_comment(uuid,uuid,uuid,text,boolean)', $s$select * into p from public.board_posts where id=p_post_id;$s$, $a$ if p.id is not null and not public.can_access_board_category(p.category_id) then raise exception 'comment_create_denied' using errcode='42501'; end if;$a$),
    -- 권한 없는 사람이 잠긴 탭으로 글을 쓰거나, 잠긴 탭의 글을 고치지 못하게 한다.
    ('public.save_board_post(uuid,uuid,text,jsonb,uuid,text,boolean,boolean,boolean,boolean,text,uuid)', $s$perform public.validate_board_document(p_content_document);$s$, $a$ if not public.can_access_board_category(p_category_id) then raise exception 'post_create_denied' using errcode='42501'; end if; if p_post_id is not null and not public.can_access_board_category((select bp.category_id from public.board_posts bp where bp.id=p_post_id)) then raise exception 'post_update_denied' using errcode='42501'; end if;$a$),
    ('public.get_board_attachment_path(uuid)', $s$select 1 from public.board_posts p where p.id=a.post_id and p.deleted_at is null$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.can_read_board_attachment_path(text)', $s$and p.deleted_at is null and p.status<>'deleted'$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.get_album_highlights(text,integer)', $s$where p.board_id = b.id$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.get_my_recent_board_posts(integer)', $s$public.can_access_board(b.id, 'list_read')$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.search_board_posts(text,integer)', $s$public.can_access_board(b.id, 'list_read')$s$, $a$ and public.can_access_board_category(p.category_id)$a$),
    ('public.get_my_dashboard_widgets()', $s$public.evaluate_board_access(b.id,'list_read',auth.uid())$s$, $a$ and public.can_access_board_category(p.category_id)$a$)
  ) as v(fn, snippet, addition)
  loop
    def := pg_get_functiondef(r.fn::regprocedure);
    -- 이미 붙였으면 건너뛴다(다시 실행해도 두 번 붙지 않게).
    continue when position(btrim(r.addition) in def) > 0;
    pat := regexp_replace(r.snippet, '([.()\[\]{}*+?^$|\\])', '\\\1', 'g');
    pat := regexp_replace(pat, ' ', '\\s+', 'g');
    select count(*) into hits from regexp_matches(def, pat, 'g');
    if hits <> 1 then
      raise exception 'category patch: % expected 1 match, got % (%)', r.fn, hits, r.snippet;
    end if;
    execute regexp_replace(def, pat, '\&' || r.addition);
  end loop;
end
$do$;

-- 일반업무 '전라남북사업부' 탭 열람자. 분류 코드는 이름과 엇갈려 있어
-- (전라남북사업부=seoul-gyeonggi) 코드가 아니라 이름으로 찾는다.
do $do$
declare
  target uuid;
  people integer;
begin
  select c.id into strict target
  from public.board_categories c join public.boards b on b.id=c.board_id
  where b.slug='general-work' and c.name='전라남북사업부';

  select count(*) into people from public.profiles where name in ('강석기','염달성','신한나');
  if people <> 3 then raise exception 'expected 3 profiles, got %', people; end if;

  insert into public.board_category_access(category_id, user_id)
  select target, p.id from public.profiles p where p.name in ('강석기','염달성','신한나')
  on conflict do nothing;
end
$do$;

commit;
