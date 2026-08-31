begin;

-- 버튼(링크 페이지 항목·버튼 박스 항목)마다 이동할 곳을 고르게 한다.
--   board    : 게시판을 목록에서 선택
--   page     : 다른 링크 페이지를 목록에서 선택
--   external : 주소를 직접 입력
-- 실제로 열 주소(url)는 서버에서 만들어 저장한다. 화면은 url만 쓰면 된다.

alter table public.link_page_items
  add column if not exists url text,
  add column if not exists target_page_id uuid references public.link_pages(id) on delete set null;

alter table public.link_page_items drop constraint if exists link_page_items_item_type_check;
alter table public.link_page_items add constraint link_page_items_item_type_check
  check (item_type in ('board', 'page', 'external'));

alter table public.link_page_items drop constraint if exists link_page_items_board_required;
alter table public.link_page_items add constraint link_page_items_target_required check (
  (item_type = 'board' and board_id is not null)
  or (item_type = 'page' and target_page_id is not null)
  or (item_type = 'external' and coalesce(btrim(url), '') <> '')
);

alter table public.button_box_items
  add column if not exists link_type text not null default 'external',
  add column if not exists board_id uuid references public.boards(id) on delete set null,
  add column if not exists target_page_id uuid references public.link_pages(id) on delete set null;

alter table public.button_box_items drop constraint if exists button_box_items_link_type_check;
alter table public.button_box_items add constraint button_box_items_link_type_check
  check (link_type in ('board', 'page', 'external'));

-- 고른 대상에서 실제 주소를 만든다. 그룹웨어는 /groupware 아래에서 돌기 때문에
-- 내부 이동도 새 탭에서 바로 열리도록 /groupware 를 붙인 전체 경로로 저장한다.
create or replace function public.resolve_link_target(
  p_type text, p_board_id uuid, p_page_id uuid, p_url text)
returns text language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  target_slug text;
  trimmed text := btrim(coalesce(p_url, ''));
begin
  if p_type = 'board' then
    select b.slug into target_slug from public.boards b where b.id = p_board_id;
    if target_slug is null then raise exception 'board_not_found' using errcode = '22023'; end if;
    return '/groupware/boards/' || target_slug;
  elsif p_type = 'page' then
    select p.slug into target_slug from public.link_pages p where p.id = p_page_id;
    if target_slug is null then raise exception 'link_page_not_found' using errcode = '22023'; end if;
    return '/groupware/pages/' || target_slug;
  elsif p_type = 'external' then
    if trimmed = '' then raise exception 'url_required' using errcode = '22023'; end if;
    -- http(s) 절대 주소나 사이트 내부 경로만 허용한다(javascript: 등 차단).
    if trimmed !~* '^(https?://|/)' then raise exception 'invalid_url' using errcode = '22023'; end if;
    return trimmed;
  end if;
  raise exception 'invalid_link_type' using errcode = '22023';
end;
$$;

revoke all on function public.resolve_link_target(text, uuid, uuid, text) from public, anon, authenticated;

-- 기존 데이터 정리: 지금까지의 링크 페이지 항목은 전부 게시판 탭이었다.
update public.link_page_items set url = public.resolve_link_target('board', board_id, null, null)
where item_type = 'board' and board_id is not null and url is null;

update public.button_box_items set link_type = 'external' where link_type is null;

commit;
