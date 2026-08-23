begin;

-- 링크트리형 업무 페이지. 제목 아래 고정 버튼 줄이 있고, 버튼마다 하위 페이지를
-- 연결한다. 버튼을 눌러도 머리글은 그대로 두고 아래 내용만 바뀐다.
-- 지금은 하위 페이지 종류로 게시판(분류 기능 포함)만 지원한다.

create table public.link_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.link_page_items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.link_pages(id) on delete cascade,
  label text not null,
  item_type text not null default 'board' check (item_type in ('board')),
  board_id uuid references public.boards(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 게시판형 항목은 게시판 연결이 필수다.
  constraint link_page_items_board_required check (item_type <> 'board' or board_id is not null)
);

create index link_page_items_page_idx on public.link_page_items (page_id, sort_order);

create trigger link_pages_set_updated_at before update on public.link_pages
  for each row execute function public.set_updated_at();
create trigger link_page_items_set_updated_at before update on public.link_page_items
  for each row execute function public.set_updated_at();

-- 접근은 전부 security definer 함수로만 한다. 게시판·위젯과 같은 방식.
alter table public.link_pages enable row level security;
alter table public.link_page_items enable row level security;
revoke all on table public.link_pages, public.link_page_items from anon, authenticated;

create or replace function public.get_my_link_pages()
returns table(id uuid, title text, slug text, description text, item_count bigint)
language sql stable security definer set search_path = pg_catalog as $$
  select p.id, p.title, p.slug, p.description,
    (select count(*) from public.link_page_items i where i.page_id = p.id)
  from public.link_pages p
  where public.is_approved_member() and p.is_active
  order by p.sort_order, p.created_at;
$$;

create or replace function public.get_link_page(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  page public.link_pages;
  items jsonb;
begin
  if not public.is_approved_member() then
    raise exception 'approved_member_required' using errcode = '42501';
  end if;
  select * into page from public.link_pages where slug = p_slug and is_active;
  if page.id is null then
    raise exception 'link_page_not_found';
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
      'description', page.description),
    'items', items);
end;
$$;

create or replace function public.admin_get_link_pages()
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select case when public.is_membership_admin() then coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'title', p.title, 'slug', p.slug, 'description', p.description,
      'is_active', p.is_active, 'sort_order', p.sort_order,
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
      sort_order = coalesce((p_page->>'sort_order')::integer, 0)
    where id = (p_page->>'id')::uuid
    returning id into v_page_id;
    if v_page_id is null then raise exception 'link_page_not_found'; end if;
  else
    insert into public.link_pages (title, slug, description, is_active, sort_order, created_by)
    values (
      btrim(p_page->>'title'),
      btrim(p_page->>'slug'),
      nullif(btrim(coalesce(p_page->>'description', '')), ''),
      coalesce((p_page->>'is_active')::boolean, true),
      coalesce((p_page->>'sort_order')::integer, 0),
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

create or replace function public.delete_link_page(p_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if not public.is_membership_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  delete from public.link_pages where id = p_id;
end;
$$;

revoke all on function public.get_my_link_pages(), public.get_link_page(text),
  public.admin_get_link_pages(), public.manage_link_page(jsonb, jsonb),
  public.delete_link_page(uuid) from public, anon;
grant execute on function public.get_my_link_pages(), public.get_link_page(text),
  public.admin_get_link_pages(), public.manage_link_page(jsonb, jsonb),
  public.delete_link_page(uuid) to authenticated;

commit;
