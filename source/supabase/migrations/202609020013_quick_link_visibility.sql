-- 버튼마다 볼 수 있는 사람을 정한다.
--
--   all          로그인한 사람 누구나
--   admin        회원 관리 권한이 있는 사람
--   super_admin  최고관리자만
alter table public.quick_links
  add column if not exists visibility text not null default 'all';

alter table public.quick_links drop constraint if exists quick_links_visibility_check;
alter table public.quick_links add constraint quick_links_visibility_check
  check (visibility in ('all','admin','super_admin'));

-- 볼 수 없는 버튼도 목록에는 남기되 **주소를 빼고** 내려준다. 주소까지 함께
-- 보내면 버튼을 감추든 말든 응답만 열어 보면 그만이라, 권한이랄 것이 없다.
-- 화면은 url 이 비어 있는 것을 보고 '조회 권한 없음'을 그린다.
create or replace function public.get_quick_links()
returns jsonb language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'label', q.label,
    'url', case when allowed then q.url else null end,
    'variant', q.variant,
    'size', q.size,
    'open_in', q.open_in,
    'can_open', allowed
  ) order by q.sort_order, q.label), '[]'::jsonb)
  from (
    select q.*,
      case q.visibility
        when 'all' then true
        when 'admin' then public.is_membership_admin()
        when 'super_admin' then public.user_has_assigned_role(auth.uid(), 'super_admin')
        else false
      end as allowed
    from public.quick_links q
    where q.is_active and auth.uid() is not null
  ) q;
$function$;

-- 저장할 때 visibility 도 함께 받는다.
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
  v_visibility text := coalesce(nullif(p_link ->> 'visibility', ''), 'all');
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
    insert into public.quick_links (label, url, variant, size, open_in, visibility, sort_order, is_active, created_by, updated_by)
    values (v_label, v_url, v_variant, v_size, v_open, v_visibility,
            coalesce((p_link ->> 'sort_order')::integer, 100),
            coalesce((p_link ->> 'is_active')::boolean, true),
            auth.uid(), auth.uid())
    returning id into link_id;
  else
    link_id := (p_link ->> 'id')::uuid;
    update public.quick_links
    set label = v_label, url = v_url, variant = v_variant, size = v_size,
        open_in = v_open, visibility = v_visibility,
        sort_order = coalesce((p_link ->> 'sort_order')::integer, 100),
        is_active = coalesce((p_link ->> 'is_active')::boolean, true),
        updated_at = now(), updated_by = auth.uid()
    where id = link_id;
    if not found then raise exception 'quick_link_not_found' using errcode = 'P0002'; end if;
  end if;
  return link_id;
end;
$function$;

-- 대표님은 최고관리자만.
update public.quick_links set visibility = 'super_admin' where label = '대표님';
