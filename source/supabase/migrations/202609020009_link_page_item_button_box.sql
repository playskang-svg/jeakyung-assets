-- 탭마다 자기 버튼을 갖게 한다.
--
-- 지금까지 버튼 박스는 페이지에 하나뿐이었다. 그래서 "탭을 고르면 그 탭의
-- 버튼이 나오고, 버튼 아래 그 탭의 게시판이 붙는" 구조를 만들 수 없었다.
-- 페이지가 아니라 항목(탭)에 박스를 매달면 그대로 된다.
--
-- 페이지 쪽 button_box_id 는 그대로 둔다. 항목 없이 버튼 박스만 쓰는 기존
-- 페이지가 계속 동작해야 한다.
alter table public.link_page_items
  add column if not exists button_box_id uuid references public.button_boxes(id) on delete set null;

-- 버튼 박스 한 개를 화면이 쓰는 모양으로 만든다. 페이지와 항목 두 곳에서
-- 같은 모양이 필요하므로 한곳에 둔다.
create or replace function public.link_page_button_box(p_box_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'pg_catalog'
as $function$
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
  from public.button_boxes bb
  where bb.id = p_box_id and bb.is_active;
$function$;

revoke all on function public.link_page_button_box(uuid) from public, anon;
grant execute on function public.link_page_button_box(uuid) to authenticated, service_role;

-- 항목마다 붙은 버튼 박스를 함께 내려준다. 화면이 탭을 바꿀 때마다 따로
-- 불러오면 누를 때마다 기다리게 된다. 페이지 한 장은 크지 않으므로 한 번에 준다.
create or replace function public.get_link_page(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog'
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

-- manage_link_page 는 항목을 넣는 한 줄만 바꾼다. 옛 정의에서 통째로 다시
-- 쓰면 그 사이에 들어간 변경이 조용히 되돌아간다.
do $$
declare src text;
  old_ins text := 'insert into public.link_page_items (page_id, label, item_type, board_id, target_page_id, url, content, sort_order)
    values (v_page_id, btrim(item->>''label''), v_type,
            case when v_type = ''board'' then v_board end,
            case when v_type = ''page'' then v_target end,
            v_url, v_content, item_position);';
  new_ins text := 'insert into public.link_page_items (page_id, label, item_type, board_id, target_page_id, url, content, button_box_id, sort_order)
    values (v_page_id, btrim(item->>''label''), v_type,
            case when v_type = ''board'' then v_board end,
            case when v_type = ''page'' then v_target end,
            v_url, v_content,
            nullif(item->>''button_box_id'', '''')::uuid,
            item_position);';
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'manage_link_page';

  if position(new_ins in src) > 0 then return; end if;
  if (length(src) - length(replace(src, old_ins, ''))) / length(old_ins) <> 1 then
    raise exception '바꿀 자리를 정확히 한 곳 찾지 못했다';
  end if;
  execute replace(src, old_ins, new_ins);
end $$;
