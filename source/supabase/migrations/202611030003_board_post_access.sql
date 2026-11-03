begin;

-- 2026-11-03 사용자 지시로 일반업무 '전라남북사업부' 탭 열람 제한(202611030001의
-- 데이터)과 숨은 사본 게시판 general-jeolla 3인 제한(202611030002)을 되돌렸다.
-- 분류 제한 장치(board_category_access·can_access_board_category)는 남겨 두되 비워 둔다.
delete from public.board_category_access
where category_id=(select c.id from public.board_categories c join public.boards b on b.id=c.board_id
                   where b.slug='general-work' and c.name='전라남북사업부');
insert into public.board_permission_rules(board_id, action, target_type, target_id, effect)
select b.id, a, 'all', null, 'allow'
from public.boards b
cross join unnest(array['attachment_download','attachment_upload','attachment_view','comment_create','detail_read','list_read','own_comment_delete','own_comment_update','own_post_delete','own_post_update','post_create','sidebar_view']) a
where b.slug='general-jeolla'
  and not exists(select 1 from public.board_permission_rules r where r.board_id=b.id and r.action=a and r.target_type='all');
delete from public.board_permission_rules
where board_id=(select id from public.boards where slug='general-jeolla') and target_type='user';

-- 게시글별 열람자. 목록에 한 줄도 없는 글은 지금처럼 게시판·분류 권한만 따른다.
-- 한 줄이라도 있으면 그 사람들만 그 글을 목록·상세·검색·최근글·댓글·반응·첨부로 볼 수 있다.
-- 권한 없는 사람에게는 목록에서도 빠진다.
create table if not exists public.board_post_access (
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.board_post_access enable row level security;
revoke all on public.board_post_access from anon, authenticated;

create or replace function public.can_access_board_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog' as $$
  select p_post_id is null
    or not exists(select 1 from public.board_post_access a where a.post_id=p_post_id)
    or exists(select 1 from public.board_post_access a where a.post_id=p_post_id and a.user_id=auth.uid());
$$;
revoke all on function public.can_access_board_post(uuid) from public, anon;
grant execute on function public.can_access_board_post(uuid) to authenticated, service_role;

-- 202611030001이 글을 내보내는 함수마다 넣어 둔 분류 검사 옆에 글 검사를 붙인다.
-- 괄호로 묶어 'or not (...)' 자리에서도 뜻이 바뀌지 않게 한다.
do $do$
declare
  fn text;
  def text;
  patched text;
begin
  foreach fn in array array[
    'public.get_board_posts(text,text,uuid,integer,text)',
    'public.get_board_post(uuid)',
    'public.get_board_reactions(uuid)',
    'public.toggle_board_reaction(uuid,text)',
    'public.save_board_comment(uuid,uuid,uuid,text,boolean)',
    'public.get_board_attachment_path(uuid)',
    'public.can_read_board_attachment_path(text)',
    'public.get_album_highlights(text,integer)',
    'public.get_my_recent_board_posts(integer)',
    'public.search_board_posts(text,integer)',
    'public.get_my_dashboard_widgets()'
  ] loop
    def := pg_get_functiondef(fn::regprocedure);
    continue when position('can_access_board_post' in def) > 0;
    patched := regexp_replace(def,
      'public\.can_access_board_category\((\w+)\.category_id\)',
      '(public.can_access_board_category(\1.category_id) and public.can_access_board_post(\1.id))', 'g');
    if patched = def then raise exception 'post patch: no category check found in %', fn; end if;
    execute patched;
  end loop;

  -- 글 수정: 열람자가 아닌 사람은 그 글을 고칠 수 없다.
  def := pg_get_functiondef('public.save_board_post(uuid,uuid,text,jsonb,uuid,text,boolean,boolean,boolean,boolean,text,uuid)'::regprocedure);
  if position('can_access_board_post' in def) = 0 then
    patched := regexp_replace(def,
      'perform\s+public\.validate_board_document\(p_content_document\);',
      '\& if p_post_id is not null and not public.can_access_board_post(p_post_id) then raise exception ''post_update_denied'' using errcode=''42501''; end if;');
    if patched = def then raise exception 'post patch: save_board_post anchor not found'; end if;
    execute patched;
  end if;
end
$do$;

-- 전라남북사업부 배차일보 글(일반업무 탭 + 숨은 사본 게시판 general-jeolla)은
-- 강석기·염달성·신한나만 열람.
do $do$
declare
  people integer;
  posts integer;
begin
  select count(*) into people from public.profiles where name in ('강석기','염달성','신한나');
  if people <> 3 then raise exception 'expected 3 profiles, got %', people; end if;

  with targets as (
    select p.id from public.board_posts p
    join public.boards b on b.id=p.board_id
    left join public.board_categories c on c.id=p.category_id
    where p.title like '%배차일보%' and p.deleted_at is null
      and ((b.slug='general-work' and c.name='전라남북사업부') or b.slug='general-jeolla')
  ), inserted as (
    insert into public.board_post_access(post_id, user_id)
    select t.id, pr.id from targets t cross join public.profiles pr
    where pr.name in ('강석기','염달성','신한나')
    on conflict do nothing
    returning post_id
  )
  select count(*) into posts from targets;
  if posts = 0 then raise exception 'no target posts'; end if;
end
$do$;

commit;
