-- 페이지 항목이 "어디로 가는 버튼"만이 아니라 "그 자리에 보여 줄 내용"도 될 수 있게 한다.
--   board / page / external / embed : 지금까지처럼 대상을 가리킨다
--   html      : 직접 작성한 HTML 문서
--   richtext  : 일반 글 편집기로 쓴 문서
--   buttons   : 바로가기 버튼 묶음
-- 내용은 content jsonb 한 칸에 담는다(유형마다 쓰는 열쇠가 다르다).

alter table public.link_page_items
  add column if not exists content jsonb not null default '{}'::jsonb;

alter table public.link_page_items drop constraint if exists link_page_items_item_type_check;
alter table public.link_page_items add constraint link_page_items_item_type_check
  check (item_type in ('board', 'page', 'external', 'embed', 'html', 'richtext', 'buttons'));

alter table public.link_page_items drop constraint if exists link_page_items_target_required;
alter table public.link_page_items add constraint link_page_items_target_required check (
  (item_type = 'board' and board_id is not null)
  or (item_type = 'page' and target_page_id is not null)
  or (item_type in ('external', 'embed') and coalesce(btrim(url), '') <> '')
  -- 내용 유형은 가리킬 대상이 없다. 빈 내용으로 만들어 두고 나중에 채울 수 있다.
  or (item_type in ('html', 'richtext', 'buttons'))
);

create or replace function public.manage_link_page(p_page jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
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
      button_box_id = nullif(p_page->>'button_box_id', '')::uuid
    where id = (p_page->>'id')::uuid
    returning id into v_page_id;
    if v_page_id is null then raise exception 'link_page_not_found'; end if;
  else
    insert into public.link_pages (title, slug, description, is_active, sort_order, button_box_id, created_by)
    values (
      btrim(p_page->>'title'),
      btrim(p_page->>'slug'),
      nullif(btrim(coalesce(p_page->>'description', '')), ''),
      coalesce((p_page->>'is_active')::boolean, true),
      coalesce((p_page->>'sort_order')::integer, 0),
      nullif(p_page->>'button_box_id', '')::uuid,
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

    insert into public.link_page_items (page_id, label, item_type, board_id, target_page_id, url, content, sort_order)
    values (v_page_id, btrim(item->>'label'), v_type,
            case when v_type = 'board' then v_board end,
            case when v_type = 'page' then v_target end,
            v_url, v_content, item_position);
    item_position := item_position + 1;
  end loop;

  return v_page_id;
end;
$$;

-- 항목의 content 를 화면까지 실어 보낸다.
create or replace function public.get_link_page(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
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

  if page.button_box_id is not null then
    select jsonb_build_object(
        'id', bb.id, 'title', bb.title, 'style', bb.style,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', bi.id, 'label', bi.label, 'description', bi.description, 'url', bi.url,
            'link_type', bi.link_type, 'thumbnail_url', bi.thumbnail_url,
            'board_slug', bb2.slug, 'page_slug', lp2.slug,
            'sort_order', bi.sort_order
          ) order by bi.sort_order, bi.created_at), '[]'::jsonb)
          from public.button_box_items bi
          left join public.boards bb2 on bb2.id = bi.board_id
          left join public.link_pages lp2 on lp2.id = bi.target_page_id
          where bi.box_id = bb.id)
      )
    into box
    from public.button_boxes bb
    where bb.id = page.button_box_id and bb.is_active;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'label', i.label, 'item_type', i.item_type,
      'board_id', i.board_id, 'board_slug', b.slug, 'board_name', b.name,
      'target_page_id', i.target_page_id, 'url', i.url,
      'content', coalesce(i.content, '{}'::jsonb),
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
$$;
