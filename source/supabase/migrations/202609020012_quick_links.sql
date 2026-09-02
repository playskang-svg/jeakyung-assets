-- 대시보드 '페이지' 박스의 버튼들.
--
-- 여태 navigation.js 에 코드로 박혀 있었다. 버튼 하나를 더하거나 주소를 고치려면
-- 배포를 해야 했다. 관리자 화면에서 다루도록 표로 옮긴다.
--
-- 크기(size)와 색(variant)은 자유 입력이 아니라 정해진 몇 가지 중에서 고른다.
-- 색상표를 열어 두면 화면마다 제각각인 버튼이 쌓이고, 대비가 모자란 조합도
-- 막을 수 없다.
create table if not exists public.quick_links (
  id uuid primary key default gen_random_uuid(),
  label text not null check (btrim(label) <> '' and length(label) <= 40),
  -- 바깥 주소(https://…) 또는 그룹웨어 안의 경로(/approval)
  url text not null check (btrim(url) <> '' and length(url) <= 500),
  variant text not null default 'plain' check (variant in ('plain','primary','navy','mint','amber','rose','violet','green')),
  size text not null default 'md' check (size in ('sm','md','lg')),
  -- frame: 화면 안 액자에서 연다 / tab: 새 탭. 액자를 거부하는 사이트가 있다.
  open_in text not null default 'frame' check (open_in in ('frame','tab')),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists quick_links_order_idx on public.quick_links (sort_order, label);

alter table public.quick_links enable row level security;
-- 읽고 쓰는 길은 아래 함수뿐이다. 표에 직접 붙는 정책은 두지 않는다.
revoke all on table public.quick_links from anon, authenticated;

-- 화면에 그릴 목록. 로그인한 사람이면 누구나 본다.
create or replace function public.get_quick_links()
returns jsonb language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'label', q.label, 'url', q.url,
    'variant', q.variant, 'size', q.size, 'open_in', q.open_in
  ) order by q.sort_order, q.label), '[]'::jsonb)
  from public.quick_links q
  where q.is_active and auth.uid() is not null;
$function$;

-- 관리자 목록. 꺼 둔 것까지 함께 내려준다.
create or replace function public.admin_get_quick_links()
returns jsonb language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_order, q.label), '[]'::jsonb)
  from public.quick_links q
  where public.is_membership_admin();
$function$;

-- 만들기와 고치기를 한곳에서. id 가 있으면 고치고 없으면 만든다.
create or replace function public.manage_quick_link(p_link jsonb)
returns uuid language plpgsql security definer set search_path to 'pg_catalog'
as $function$
declare
  link_id uuid;
  v_label text := btrim(coalesce(p_link ->> 'label', ''));
  v_url text := btrim(coalesce(p_link ->> 'url', ''));
  v_variant text := coalesce(nullif(p_link ->> 'variant', ''), 'plain');
  v_size text := coalesce(nullif(p_link ->> 'size', ''), 'md');
  v_open text := coalesce(nullif(p_link ->> 'open_in', ''), 'frame');
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;
  if v_label = '' or v_url = '' then
    raise exception 'invalid_quick_link' using errcode = '22023';
  end if;
  -- 주소는 http(s) 이거나 그룹웨어 안의 경로여야 한다. javascript: 같은 것을
  -- 버튼에 걸 수 없게 막는다.
  if not (v_url ~* '^https?://' or v_url ~ '^/[A-Za-z0-9/_-]*$') then
    raise exception 'invalid_quick_link_url' using errcode = '22023';
  end if;
  -- 그룹웨어 안의 경로는 늘 그 자리에서 이동한다. 액자에 넣을 이유가 없다.
  if v_url ~ '^/' then v_open := 'frame'; end if;

  if nullif(p_link ->> 'id', '') is null then
    insert into public.quick_links (label, url, variant, size, open_in, sort_order, is_active, created_by, updated_by)
    values (v_label, v_url, v_variant, v_size, v_open,
            coalesce((p_link ->> 'sort_order')::integer, 100),
            coalesce((p_link ->> 'is_active')::boolean, true),
            auth.uid(), auth.uid())
    returning id into link_id;
  else
    link_id := (p_link ->> 'id')::uuid;
    update public.quick_links
    set label = v_label, url = v_url, variant = v_variant, size = v_size, open_in = v_open,
        sort_order = coalesce((p_link ->> 'sort_order')::integer, 100),
        is_active = coalesce((p_link ->> 'is_active')::boolean, true),
        updated_at = now(), updated_by = auth.uid()
    where id = link_id;
    if not found then raise exception 'quick_link_not_found' using errcode = 'P0002'; end if;
  end if;
  return link_id;
end;
$function$;

create or replace function public.delete_quick_link(p_id uuid)
returns void language plpgsql security definer set search_path to 'pg_catalog'
as $function$
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;
  delete from public.quick_links where id = p_id;
  if not found then raise exception 'quick_link_not_found' using errcode = 'P0002'; end if;
end;
$function$;

revoke all on function public.get_quick_links() from public;
revoke all on function public.admin_get_quick_links() from public;
revoke all on function public.manage_quick_link(jsonb) from public;
revoke all on function public.delete_quick_link(uuid) from public;
grant execute on function public.get_quick_links() to authenticated;
grant execute on function public.admin_get_quick_links() to authenticated;
grant execute on function public.manage_quick_link(jsonb) to authenticated;
grant execute on function public.delete_quick_link(uuid) to authenticated;

-- 지금 코드에 박혀 있던 버튼을 그대로 옮긴다. 순서와 강조도 화면 그대로.
insert into public.quick_links (label, url, variant, size, open_in, sort_order)
values
  ('사내메일',        'https://mail.jeakyung.com/',                        'primary', 'md', 'tab',   10),
  ('전자결재',        '/approval',                                          'navy',    'md', 'frame', 20),
  ('조직도',          '/organization',                                      'plain',   'md', 'frame', 30),
  ('사내일정',        'https://jeakyung.quv.kr/36',                         'plain',   'md', 'frame', 35),
  ('파일',            '/files',                                             'plain',   'md', 'frame', 40),
  ('지입업무',        'https://jeakyung.quv.kr/41',                         'plain',   'md', 'frame', 45),
  ('적격수급평가',    'https://jeakyung.com/hl-safety-eval/',               'plain',   'md', 'frame', 50),
  ('대표님',          'https://jeakyung.quv.kr/17',                         'plain',   'md', 'frame', 60),
  ('결제 링크 발송',  'https://seller.payapp.kr/r/using_reg?payreqtype=krw','plain',   'md', 'tab',   70)
on conflict do nothing;
