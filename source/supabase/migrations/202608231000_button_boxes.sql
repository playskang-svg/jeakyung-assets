begin;

-- 버튼 박스: 제목과 URL만으로 이루어진 큰 카드형 버튼 묶음. 링크 페이지와
-- 대시보드 위젯 양쪽에서 그대로 골라 쓸 수 있도록 별도 엔티티로 둔다.
-- 스타일은 관리자가 고르는 3종(cards/tiles/list)만 지원한다.

create table public.button_boxes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  style text not null default 'cards' check (style in ('cards', 'tiles', 'list')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.button_box_items (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.button_boxes(id) on delete cascade,
  label text not null,
  description text,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index button_box_items_box_idx on public.button_box_items (box_id, sort_order);

create trigger button_boxes_set_updated_at before update on public.button_boxes
  for each row execute function public.set_updated_at();
create trigger button_box_items_set_updated_at before update on public.button_box_items
  for each row execute function public.set_updated_at();

-- 접근은 전부 security definer 함수로만 한다. 게시판·링크 페이지와 같은 방식.
alter table public.button_boxes enable row level security;
alter table public.button_box_items enable row level security;
revoke all on table public.button_boxes, public.button_box_items from anon, authenticated;

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
      'sort_order', i.sort_order
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
          'sort_order', i.sort_order
        ) order by i.sort_order, i.created_at), '[]'::jsonb)
        from public.button_box_items i where i.box_id = p.id)
    ) order by p.created_at), '[]'::jsonb)
  else null end
  from public.button_boxes p;
$$;

create or replace function public.manage_button_box(p_box jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_box_id uuid;
  item jsonb;
  item_position integer := 0;
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

  -- 항목은 통째로 갈아끼운다. 다른 곳에서 항목 id를 참조하지 않으므로 안전하다.
  delete from public.button_box_items where box_id = v_box_id;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(btrim(item->>'label'), '') = '' then raise exception 'item_label_required'; end if;
    if coalesce(btrim(item->>'url'), '') = '' then raise exception 'item_url_required'; end if;
    insert into public.button_box_items (box_id, label, description, url, sort_order)
    values (
      v_box_id,
      btrim(item->>'label'),
      nullif(btrim(coalesce(item->>'description', '')), ''),
      btrim(item->>'url'),
      item_position);
    item_position := item_position + 1;
  end loop;

  return v_box_id;
end;
$$;

create or replace function public.delete_button_box(p_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not public.is_membership_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  delete from public.button_boxes where id = p_id;
end;
$$;

revoke all on function public.get_button_box(uuid), public.admin_get_button_boxes(),
  public.manage_button_box(jsonb, jsonb), public.delete_button_box(uuid) from public, anon;
grant execute on function public.get_button_box(uuid), public.admin_get_button_boxes(),
  public.manage_button_box(jsonb, jsonb), public.delete_button_box(uuid) to authenticated;

-- 대시보드 위젯에서도 그대로 고를 수 있도록 위젯 유형을 하나 늘린다.
alter table public.dashboard_widgets drop constraint dashboard_widgets_widget_type_check;
alter table public.dashboard_widgets add constraint dashboard_widgets_widget_type_check
  check (widget_type = any (array[
    'notices', 'approval_status', 'today_schedule', 'week_schedule', 'recent_posts',
    'mail_link', 'quick_links', 'emergency_alert', 'custom_link', 'custom_notice',
    'button_box'
  ]));

-- 링크 페이지 본문에도 버튼 박스를 그대로 꽂을 수 있게 한다. 지정돼 있으면
-- 기존 하위 게시판 탭 대신 이 버튼 박스를 본문에 렌더링한다.
alter table public.link_pages add column button_box_id uuid references public.button_boxes(id) on delete set null;

-- get_link_page / admin_get_link_pages / manage_link_page를 button_box_id를
-- 다루도록 다시 정의한다. 시그니처(인자 타입)는 그대로라 교체만 하면 된다.
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
          'board_id', i.board_id, 'sort_order', i.sort_order
        ) order by i.sort_order, i.created_at), '[]'::jsonb)
        from public.link_page_items i where i.page_id = p.id)
    ) order by p.sort_order, p.created_at), '[]'::jsonb)
  else null end
  from public.link_pages p;
$$;

create or replace function public.manage_link_page(p_page jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_page_id uuid;
  item jsonb;
  item_position integer := 0;
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

  -- 항목은 통째로 갈아끼운다. 다른 곳에서 항목 id를 참조하지 않으므로 안전하다.
  delete from public.link_page_items where page_id = v_page_id;
  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(btrim(item->>'label'), '') = '' then raise exception 'item_label_required'; end if;
    insert into public.link_page_items (page_id, label, item_type, board_id, sort_order)
    values (
      v_page_id,
      btrim(item->>'label'),
      coalesce(item->>'item_type', 'board'),
      (item->>'board_id')::uuid,
      item_position);
    item_position := item_position + 1;
  end loop;

  return v_page_id;
end;
$$;

commit;
