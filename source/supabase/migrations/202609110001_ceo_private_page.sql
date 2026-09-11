-- 대표님 전용 페이지.
--
-- 홈 '페이지' 줄의 '대표님'(옛 인트라넷 17번)을 '대표님기존'으로 바꾸고, 그 옆에
-- '대표님 전용'을 세운다. 누르면 폴더 버튼 줄(구글 드라이브 폴더 + 스프레드시트)
-- 아래 통합 게시판이 붙은 업무 페이지가 열린다. 볼 수 있는 사람은 염달성·강석기·
-- 김동현 세 명이다.
--
-- 이 일로 기능 셋을 함께 더한다.
--   1. 페이지에도 '볼 수 있는 사람'(visibility)을 둔다. 여태 페이지는 승인된 사람이면
--      누구나 열 수 있었다. 게시판을 막아도 페이지에 달린 버튼 주소는 그대로 보였다.
--   2. 버튼 박스 디자인에 폴더형(folders)을 더한다.
--   3. 외부 주소 버튼에 '#'(아직 주소를 정하지 않은 자리)을 받는다. 관리자 화면은
--      빈 주소를 이미 '#'으로 보내는데 서버가 막아서, 자리만 만들어 둔 버튼 박스는
--      다시 저장할 수 없었다.
--
-- 덤으로 admin_get_link_pages 가 항목의 content·button_box_id 를 내려주지 않던 것을
-- 고친다. 관리자 화면에서 페이지를 열어 저장하면 탭에 매단 버튼 줄과 작성한 글이
-- 지워졌다.
begin;

-- 1. 페이지 공개 범위 ---------------------------------------------------------

alter table public.link_pages
  add column if not exists visibility text not null default 'all';

alter table public.link_pages drop constraint if exists link_pages_visibility_check;
alter table public.link_pages add constraint link_pages_visibility_check
  check (visibility in ('all','admin','super_admin'));

-- 페이지 이동 버튼(get_quick_links)과 같은 기준으로 판정한다. 두 곳의 말이 다르면
-- 버튼은 열리는데 페이지는 막히는 일이 생긴다.
create or replace function public.link_page_visible(p_visibility text)
returns boolean language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select public.is_approved_member() and case p_visibility
    when 'all' then true
    when 'admin' then public.is_membership_admin()
    when 'super_admin' then public.user_has_assigned_role(auth.uid(), 'super_admin')
    else false
  end;
$function$;

create or replace function public.get_my_link_pages()
returns table(id uuid, title text, slug text, description text, item_count bigint)
language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select p.id, p.title, p.slug, p.description,
    (select count(*) from public.link_page_items i where i.page_id = p.id)
  from public.link_pages p
  where p.is_active and public.link_page_visible(p.visibility)
  order by p.sort_order, p.created_at;
$function$;

create or replace function public.get_link_page(p_slug text)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog'
as $function$
declare
  page public.link_pages;
  items jsonb;
  box jsonb;
begin
  if not public.is_approved_member() then
    raise exception 'approved_member_required' using errcode = '42501';
  end if;
  select * into page from public.link_pages where slug = p_slug and is_active;
  if page.id is null then
    raise exception 'link_page_not_found';
  end if;
  -- 볼 수 없는 페이지는 항목도 버튼 주소도 내려주지 않는다. 화면이 이 문장을
  -- 그대로 보여 준다.
  if not public.link_page_visible(page.visibility) then
    raise exception '이 페이지를 볼 권한이 없습니다.' using errcode = '42501';
  end if;

  if page.button_box_id is not null then
    select public.link_page_button_box(page.button_box_id) into box;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'label', i.label, 'item_type', i.item_type,
      'board_id', i.board_id, 'board_slug', b.slug, 'board_name', b.name,
      'target_page_id', i.target_page_id, 'url', i.url,
      'content', coalesce(i.content, '{}'::jsonb),
      'button_box', public.link_page_button_box(i.button_box_id),
      'sort_order', i.sort_order
    ) order by i.sort_order, i.created_at), '[]'::jsonb)
  into items
  from public.link_page_items i
  left join public.boards b on b.id = i.board_id
  where i.page_id = page.id;

  return jsonb_build_object(
    'page', jsonb_build_object('id', page.id, 'title', page.title, 'slug', page.slug,
      'description', page.description, 'button_box_id', page.button_box_id),
    'items', items,
    'button_box', box);
end;
$function$;

create or replace function public.admin_get_link_pages()
returns jsonb language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select case when public.is_membership_admin() then coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'slug', p.slug, 'description', p.description,
      'is_active', p.is_active, 'sort_order', p.sort_order, 'button_box_id', p.button_box_id,
      'visibility', p.visibility,
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'label', i.label, 'item_type', i.item_type,
          'board_id', i.board_id, 'target_page_id', i.target_page_id, 'url', i.url,
          'content', coalesce(i.content, '{}'::jsonb), 'button_box_id', i.button_box_id,
          'sort_order', i.sort_order
        ) order by i.sort_order, i.created_at), '[]'::jsonb)
        from public.link_page_items i where i.page_id = p.id)
    ) order by p.sort_order, p.created_at), '[]'::jsonb)
  else null end
  from public.link_pages p;
$function$;

-- visibility 를 함께 받는다. 키가 없으면(예전 화면에서 저장) 원래 값을 둔다 —
-- 비어 있다고 '모두'로 풀어 버리면 저장 한 번에 전용 페이지가 열린다.
create or replace function public.manage_link_page(p_page jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare
  v_page_id uuid;
  item jsonb;
  button jsonb;
  item_position integer := 0;
  v_type text;
  v_board uuid;
  v_target uuid;
  v_url text;
  v_content jsonb;
  v_button_url text;
begin
  if not public.is_membership_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if coalesce(btrim(p_page->>'title'), '') = '' then raise exception 'title_required'; end if;
  if coalesce(btrim(p_page->>'slug'), '') = '' then raise exception 'slug_required'; end if;

  if p_page->>'id' is not null then
    update public.link_pages set
      title = btrim(p_page->>'title'),
      slug = btrim(p_page->>'slug'),
      description = nullif(btrim(coalesce(p_page->>'description', '')), ''),
      is_active = coalesce((p_page->>'is_active')::boolean, true),
      sort_order = coalesce((p_page->>'sort_order')::integer, 0),
      button_box_id = nullif(p_page->>'button_box_id', '')::uuid,
      visibility = coalesce(nullif(p_page->>'visibility', ''), visibility)
    where id = (p_page->>'id')::uuid
    returning id into v_page_id;
    if v_page_id is null then raise exception 'link_page_not_found'; end if;
  else
    insert into public.link_pages (title, slug, description, is_active, sort_order, button_box_id, visibility, created_by)
    values (
      btrim(p_page->>'title'),
      btrim(p_page->>'slug'),
      nullif(btrim(coalesce(p_page->>'description', '')), ''),
      coalesce((p_page->>'is_active')::boolean, true),
      coalesce((p_page->>'sort_order')::integer, 0),
      nullif(p_page->>'button_box_id', '')::uuid,
      coalesce(nullif(p_page->>'visibility', ''), 'all'),
      auth.uid())
    returning id into v_page_id;
  end if;

  delete from public.link_page_items where page_id = v_page_id;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(btrim(item->>'label'), '') = '' then raise exception 'item_label_required'; end if;

    v_type := coalesce(nullif(btrim(item->>'item_type'), ''), 'board');
    v_board := nullif(item->>'board_id', '')::uuid;
    v_target := nullif(item->>'target_page_id', '')::uuid;
    v_content := '{}'::jsonb;
    v_url := null;

    if v_type in ('board', 'page', 'external', 'embed') then
      v_url := public.resolve_link_target(v_type, v_board, v_target, item->>'url');
      -- 자기 자신을 가리키는 페이지 버튼은 무한 루프라 막는다.
      if v_type = 'page' and v_target = v_page_id then
        raise exception 'self_reference_not_allowed' using errcode = '22023';
      end if;

    elsif v_type = 'html' then
      v_content := jsonb_build_object('html', coalesce(item->'content'->>'html', ''));

    elsif v_type = 'richtext' then
      v_content := jsonb_build_object('document', coalesce(item->'content'->'document', '{}'::jsonb));

    elsif v_type = 'buttons' then
      -- 버튼 하나하나의 주소를 서버에서 검사한다. 화면 쪽 검사만 믿지 않는다.
      for button in select value from jsonb_array_elements(coalesce(item->'content'->'buttons', '[]'::jsonb)) loop
        v_button_url := btrim(coalesce(button->>'url', ''));
        if v_button_url = '' then raise exception 'button_url_required' using errcode = '22023'; end if;
        if v_button_url !~* '^(https?://|/)' then raise exception 'invalid_button_url' using errcode = '22023'; end if;
      end loop;
      v_content := jsonb_build_object('buttons', coalesce(item->'content'->'buttons', '[]'::jsonb));
    end if;

    insert into public.link_page_items (page_id, label, item_type, board_id, target_page_id, url, content, button_box_id, sort_order)
    values (v_page_id, btrim(item->>'label'), v_type,
            case when v_type = 'board' then v_board end,
            case when v_type = 'page' then v_target end,
            v_url, v_content,
            -- 탭마다 자기 버튼 줄을 가질 수 있다. 비어 있으면 버튼 없이 내용만 나온다.
            nullif(item->>'button_box_id', '')::uuid,
            item_position);
    item_position := item_position + 1;
  end loop;

  return v_page_id;
end;
$function$;

revoke all on function public.link_page_visible(text) from public, anon;
grant execute on function public.link_page_visible(text) to authenticated;

-- 2. 폴더형 버튼 박스 ---------------------------------------------------------

alter table public.button_boxes drop constraint if exists button_boxes_style_check;
alter table public.button_boxes add constraint button_boxes_style_check
  check (style in ('cards','tiles','list','folders'));

-- 3. 주소를 아직 정하지 않은 버튼('#') ------------------------------------------

create or replace function public.resolve_link_target(p_type text, p_board_id uuid, p_page_id uuid, p_url text)
returns text language plpgsql stable security definer set search_path to 'pg_catalog'
as $function$
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
    -- '#' 은 자리만 먼저 만들어 둔 버튼이다. 화면은 이것을 누를 수 없는 버튼으로 그린다.
    if trimmed = '#' then return trimmed; end if;
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
$function$;

-- 4. 대표님 전용 페이지 데이터 -------------------------------------------------

-- 옛 인트라넷으로 가는 버튼은 남기되 이름으로 구분한다.
update public.quick_links set label = '대표님기존', updated_at = now()
where label = '대표님' and url = 'https://jeakyung.quv.kr/17';

-- 통합 게시판. 페이지 탭으로만 들어오므로 홈·게시판 목록에서는 숨긴다.
-- 설정값은 manage_board 의 기본값과 같다.
insert into public.boards (group_id, name, slug, description, board_type, sort_order, is_active, settings)
values (
  '679d0508-671c-4157-9727-1bdf66216b27'::uuid, -- 회사
  '대표님 전용 게시판', 'ceo-private-board', '대표님 전용 통합 게시판입니다.', 'free', 300, true,
  '{"show_in_sidebar":false,"allow_comments":true,"allow_replies":true,"allow_attachments":true,"allow_images":true,"allow_anonymous":false,"allow_reactions":true,"allow_notices":true,"allow_important":true,"show_views":true,"show_author_department":true,"show_author_position":false,"show_author_job_title":true,"show_post_number":true,"search_enabled":true,"use_prefix":false,"use_pinned":true,"page_size":20,"default_sort":"latest","max_file_size_mb":20,"max_inline_image_size_mb":10,"max_inline_images":20,"max_total_attachment_mb":50,"preserve_image_originals":false}'::jsonb)
on conflict (slug) do nothing;

-- 사람 이름으로 권한을 준다. '전체'나 역할로 주면 관리자 화면에서 누가 볼 수
-- 있는지 한눈에 보이지 않는다. 세 사람 모두 지금 시스템 관리자라 규칙이 없어도
-- 열리지만, 역할이 바뀌어도 이 게시판 권한은 남도록 적어 둔다.
insert into public.board_permission_rules (board_id, action, target_type, target_id, effect)
select b.id, a.action, 'user', p.id::text, 'allow'
from public.boards b
cross join (values
  ('sidebar_view'),('list_read'),('detail_read'),
  ('post_create'),('own_post_update'),('own_post_delete'),
  ('comment_create'),('own_comment_update'),('own_comment_delete'),
  ('attachment_view'),('attachment_download'),('attachment_upload')
) as a(action)
join public.profiles p on p.id in (
  'e0ebd311-ee14-4b1f-80b4-a1cd586af3ab'::uuid, -- 염달성
  '58530263-8e46-4fd3-b244-ceea4e7ca91f'::uuid, -- 강석기
  '03b64e15-a65f-4dda-b72f-8dfd3a82d461'::uuid  -- 김동현
)
where b.slug = 'ceo-private-board'
  and not exists (
    select 1 from public.board_permission_rules r
    where r.board_id = b.id and r.action = a.action
      and r.target_type = 'user' and r.target_id = p.id::text
  );

do $$
declare
  v_box uuid;
  v_page uuid;
  v_board uuid;
begin
  select id into v_board from public.boards where slug = 'ceo-private-board';

  -- 폴더 버튼 줄. 6~8번은 자리만 잡아 두고, 관리자 화면(버튼 박스)에서 채운다.
  select id into v_box from public.button_boxes where title = '대표님 전용 바로가기' limit 1;
  if v_box is null then
    insert into public.button_boxes (title, style, is_active)
    values ('대표님 전용 바로가기', 'folders', true)
    returning id into v_box;
  end if;
  if not exists (select 1 from public.button_box_items where box_id = v_box) then
    insert into public.button_box_items (box_id, label, description, link_type, url, sort_order)
    values
      (v_box, '구글 드라이브', '파일 만들기·편집', 'external', 'https://drive.google.com/drive/folders/1P96tlEAcC1DCP25gqwNjrOGL3NRPxKig?usp=drive_link', 0),
      (v_box, '기존 #1', '구글 스프레드시트', 'external', 'https://docs.google.com/spreadsheets/d/1k9uN4PET7uM0EDMKrIzfmT622oIRVUirRkU2goOas2w/edit?usp=sharing', 1),
      (v_box, '기존 #2', '구글 스프레드시트', 'external', 'https://docs.google.com/spreadsheets/d/1Vi4RIzTF2dALimYnisENHxWKWNMJ5Qnfw9p4uo1bH2Q/edit?usp=sharing', 2),
      (v_box, '기존 #3', '구글 스프레드시트', 'external', 'https://docs.google.com/spreadsheets/d/1ebmOJoi6eEq9DzWU0z3EpDiTaXShDnteKanZqKXNtg0/edit?usp=sharing', 3),
      (v_box, '기존 #4', '구글 스프레드시트', 'external', 'https://docs.google.com/spreadsheets/d/1rNvPFyokMKYMjXLvFGI1pMVn-b8llQrDxmOradGtOhU/edit?usp=sharing', 4),
      (v_box, '생성 예정', null, 'external', '#', 5),
      (v_box, '생성 예정', null, 'external', '#', 6),
      (v_box, '생성 예정', null, 'external', '#', 7);
  end if;

  select id into v_page from public.link_pages where slug = 'ceo-private';
  if v_page is null then
    insert into public.link_pages (title, slug, description, is_active, sort_order, visibility)
    values ('대표님 전용', 'ceo-private', '대표님 전용 자료 폴더와 통합 게시판입니다.', true, 90, 'super_admin')
    returning id into v_page;
  end if;
  if not exists (select 1 from public.link_page_items where page_id = v_page) then
    insert into public.link_page_items (page_id, label, item_type, board_id, url, button_box_id, sort_order)
    values (v_page, '통합 게시판', 'board', v_board, '/groupware/boards/ceo-private-board', v_box, 0);
  end if;
end $$;

-- 홈 '페이지' 줄. '대표님기존'(60)과 '결제 링크 발송'(70) 사이에 선다. 공개 범위는
-- 페이지와 같게 둔다 — 버튼은 열리는데 페이지가 막히면 고장으로 보인다.
insert into public.quick_links (label, url, variant, size, open_in, visibility, sort_order)
select '대표님 전용', '/pages/ceo-private', 'plain', 'md', 'frame', 'super_admin', 65
where not exists (select 1 from public.quick_links where url = '/pages/ceo-private');

commit;
