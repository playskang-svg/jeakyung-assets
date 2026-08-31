-- 링크 페이지·버튼 박스 RPC 를 새 대상 필드(item_type/link_type, board_id,
-- target_page_id, url)를 다루도록 다시 정의한다. 시그니처는 그대로라 교체만 하면 된다.
-- 운영 DB에 적용된 정의와 동일하다.

begin;

create or replace function public.manage_link_page(p_page jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_page_id uuid;
  item jsonb;
  item_position integer := 0;
  v_type text;
  v_board uuid;
  v_target uuid;
  v_url text;
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
    v_url := public.resolve_link_target(v_type, v_board, v_target, item->>'url');

    -- 자기 자신을 가리키는 페이지 버튼은 무한 루프라 막는다.
    if v_type = 'page' and v_target = v_page_id then
      raise exception 'self_reference_not_allowed' using errcode = '22023';
    end if;

    insert into public.link_page_items (page_id, label, item_type, board_id, target_page_id, url, sort_order)
    values (v_page_id, btrim(item->>'label'), v_type,
            case when v_type = 'board' then v_board end,
            case when v_type = 'page' then v_target end,
            v_url, item_position);
    item_position := item_position + 1;
  end loop;

  return v_page_id;
end;
$$;

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
            'sort_order', bi.sort_order
          ) order by bi.sort_order, bi.created_at), '[]'::jsonb)
          from public.button_box_items bi where bi.box_id = bb.id)
      )
    into box
    from public.button_boxes bb
    where bb.id = page.button_box_id and bb.is_active;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'label', i.label, 'item_type', i.item_type,
      'board_id', i.board_id, 'board_slug', b.slug, 'board_name', b.name,
      'target_page_id', i.target_page_id, 'url', i.url,
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

create or replace function public.admin_get_link_pages()
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select case when public.is_membership_admin() then coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'slug', p.slug, 'description', p.description,
      'is_active', p.is_active, 'sort_order', p.sort_order, 'button_box_id', p.button_box_id,
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'label', i.label, 'item_type', i.item_type,
          'board_id', i.board_id, 'target_page_id', i.target_page_id, 'url', i.url,
          'sort_order', i.sort_order
        ) order by i.sort_order, i.created_at), '[]'::jsonb)
        from public.link_page_items i where i.page_id = p.id)
    ) order by p.sort_order, p.created_at), '[]'::jsonb)
  else null end
  from public.link_pages p;
$$;

create or replace function public.manage_button_box(p_box jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_box_id uuid;
  item jsonb;
  item_position integer := 0;
  v_type text;
  v_board uuid;
  v_target uuid;
  v_url text;
begin
  if not public.is_membership_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if coalesce(btrim(p_box->>'title'), '') = '' then raise exception 'title_required'; end if;

  if p_box->>'id' is not null then
    update public.button_boxes set
      title = btrim(p_box->>'title'),
      style = coalesce(nullif(btrim(p_box->>'style'), ''), 'cards'),
      is_active = coalesce((p_box->>'is_active')::boolean, true)
    where id = (p_box->>'id')::uuid
    returning id into v_box_id;
    if v_box_id is null then raise exception 'button_box_not_found'; end if;
  else
    insert into public.button_boxes (title, style, is_active, created_by)
    values (
      btrim(p_box->>'title'),
      coalesce(nullif(btrim(p_box->>'style'), ''), 'cards'),
      coalesce((p_box->>'is_active')::boolean, true),
      auth.uid())
    returning id into v_box_id;
  end if;

  delete from public.button_box_items where box_id = v_box_id;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(btrim(item->>'label'), '') = '' then raise exception 'item_label_required'; end if;

    v_type := coalesce(nullif(btrim(item->>'link_type'), ''), 'external');
    v_board := nullif(item->>'board_id', '')::uuid;
    v_target := nullif(item->>'target_page_id', '')::uuid;
    v_url := public.resolve_link_target(v_type, v_board, v_target, item->>'url');

    insert into public.button_box_items (box_id, label, description, url, link_type, board_id, target_page_id, sort_order)
    values (
      v_box_id,
      btrim(item->>'label'),
      nullif(btrim(coalesce(item->>'description', '')), ''),
      v_url, v_type,
      case when v_type = 'board' then v_board end,
      case when v_type = 'page' then v_target end,
      item_position);
    item_position := item_position + 1;
  end loop;

  return v_box_id;
end;
$$;

create or replace function public.get_button_box(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  box public.button_boxes;
  items jsonb;
begin
  if not public.is_approved_member() then
    raise exception 'approved_member_required' using errcode = '42501';
  end if;
  select * into box from public.button_boxes where id = p_id and is_active;
  if box.id is null then
    raise exception 'button_box_not_found';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'label', i.label, 'description', i.description, 'url', i.url,
      'link_type', i.link_type, 'sort_order', i.sort_order
    ) order by i.sort_order, i.created_at), '[]'::jsonb)
  into items
  from public.button_box_items i
  where i.box_id = box.id;
  return jsonb_build_object(
    'box', jsonb_build_object('id', box.id, 'title', box.title, 'style', box.style),
    'items', items);
end;
$$;

create or replace function public.admin_get_button_boxes()
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select case when public.is_membership_admin() then coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'style', p.style, 'is_active', p.is_active,
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'label', i.label, 'description', i.description, 'url', i.url,
          'link_type', i.link_type, 'board_id', i.board_id, 'target_page_id', i.target_page_id,
          'sort_order', i.sort_order
        ) order by i.sort_order, i.created_at), '[]'::jsonb)
        from public.button_box_items i where i.box_id = p.id)
    ) order by p.created_at), '[]'::jsonb)
  else null end
  from public.button_boxes p;
$$;

commit;
