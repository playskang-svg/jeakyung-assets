-- 화면 안에 그대로 띄우는 대상(embed)을 추가한다.
-- external 은 새 탭으로 나가지만 embed 는 그룹웨어 화면 안에서 iframe 으로 연다.
-- iframe 은 https 페이지 안에서 http 를 못 싣기 때문에 http:// 는 받지 않는다.

alter table public.link_page_items drop constraint if exists link_page_items_item_type_check;
alter table public.link_page_items add constraint link_page_items_item_type_check
  check (item_type in ('board', 'page', 'external', 'embed'));

alter table public.link_page_items drop constraint if exists link_page_items_target_required;
alter table public.link_page_items add constraint link_page_items_target_required check (
  (item_type = 'board' and board_id is not null)
  or (item_type = 'page' and target_page_id is not null)
  or (item_type in ('external', 'embed') and coalesce(btrim(url), '') <> '')
);

alter table public.button_box_items drop constraint if exists button_box_items_link_type_check;
alter table public.button_box_items add constraint button_box_items_link_type_check
  check (link_type in ('board', 'page', 'external', 'embed'));

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
  elsif p_type = 'embed' then
    if trimmed = '' then raise exception 'url_required' using errcode = '22023'; end if;
    -- 화면 안에 싣는 주소라 https 나 내부 경로만 받는다. http 는 브라우저가 막는다.
    if trimmed !~* '^(https://|/)' then raise exception 'invalid_embed_url' using errcode = '22023'; end if;
    return trimmed;
  end if;
  raise exception 'invalid_link_type' using errcode = '22023';
end;
$$;

revoke all on function public.resolve_link_target(text, uuid, uuid, text) from public, anon, authenticated;
