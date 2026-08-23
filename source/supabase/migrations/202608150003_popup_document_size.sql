begin;

-- 팝업 크기를 관리자가 고를 수 있게 한다. 안내문 한 줄짜리 팝업과 회사 소개처럼
-- 내용이 긴 팝업이 같은 폭으로 떠서 어느 한쪽은 늘 어색했다.
alter table public.popup_documents
  add column if not exists size text not null default 'medium';

alter table public.popup_documents
  drop constraint if exists popup_documents_size_allowed;

alter table public.popup_documents
  add constraint popup_documents_size_allowed check (size in ('small', 'medium', 'large', 'full'));

-- 조회 함수는 반환 컬럼이 고정이라 size를 명시적으로 추가한다.
-- (관리자 카탈로그는 to_jsonb(d)라 새 컬럼이 그대로 따라간다.)
drop function if exists public.get_active_popup_documents(text);

create function public.get_active_popup_documents(p_target text)
returns table (
  id uuid,
  title text,
  content_mode text,
  content_html text,
  size text,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if p_target not in (
    'groupware_dashboard','groupware_boards','groupware_approval','groupware_admin',
    'public_home','public_privacy'
  ) then
    raise exception 'invalid_popup_target' using errcode = '22023';
  end if;

  if p_target like 'groupware_%' and not public.is_approved_member() then
    return;
  end if;

  return query
  select d.id, d.title, d.content_mode, d.content_html, d.size, d.starts_at, d.ends_at
  from public.popup_documents d
  where d.is_active
    and d.archived_at is null
    and d.starts_at <= now()
    and (d.ends_at is null or d.ends_at > now())
    and (
      p_target = any(d.targets)
      or (p_target like 'groupware_%' and 'groupware_all' = any(d.targets))
      or (p_target like 'public_%' and 'public_all' = any(d.targets))
    )
  order by d.sort_order, d.starts_at desc, d.created_at desc;
end;
$$;

revoke all on function public.get_active_popup_documents(text) from public, anon, authenticated;
grant execute on function public.get_active_popup_documents(text) to anon, authenticated;

-- 저장 함수에 size를 받는다. 값이 없거나 허용 목록 밖이면 medium으로 떨어뜨린다.
create or replace function public.manage_popup_document(p_document jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  popup_id uuid;
  previous_row jsonb;
  saved_row jsonb;
  target_values text[];
  allowed_targets constant text[] := array[
    'groupware_all','groupware_dashboard','groupware_boards','groupware_approval','groupware_admin',
    'public_all','public_home','public_privacy'
  ]::text[];
  popup_title text := btrim(coalesce(p_document ->> 'title', ''));
  popup_mode text := coalesce(nullif(p_document ->> 'content_mode', ''), 'editor');
  popup_html text := btrim(coalesce(p_document ->> 'content_html', ''));
  popup_size text := coalesce(nullif(p_document ->> 'size', ''), 'medium');
  popup_starts_at timestamptz;
  popup_ends_at timestamptz;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  if popup_title = '' or popup_html = '' then
    raise exception 'invalid_popup_content' using errcode = '22023';
  end if;

  if popup_mode not in ('editor', 'html') then
    raise exception 'invalid_popup_mode' using errcode = '22023';
  end if;

  if popup_size not in ('small', 'medium', 'large', 'full') then
    popup_size := 'medium';
  end if;

  select coalesce(array_agg(value), array[]::text[])
  into target_values
  from jsonb_array_elements_text(coalesce(p_document -> 'targets', '[]'::jsonb));

  if cardinality(target_values) = 0 or not target_values <@ allowed_targets then
    raise exception 'invalid_popup_targets' using errcode = '22023';
  end if;

  popup_starts_at := coalesce(nullif(p_document ->> 'starts_at', '')::timestamptz, now());
  popup_ends_at := nullif(p_document ->> 'ends_at', '')::timestamptz;
  if popup_ends_at is not null and popup_ends_at <= popup_starts_at then
    raise exception 'invalid_popup_period' using errcode = '22023';
  end if;

  if nullif(p_document ->> 'id', '') is null then
    insert into public.popup_documents (
      title, content_mode, content_html, size, targets, starts_at, ends_at, sort_order,
      is_active, archived_at, created_by, updated_by
    ) values (
      popup_title, popup_mode, popup_html, popup_size, target_values, popup_starts_at, popup_ends_at,
      coalesce((p_document ->> 'sort_order')::integer, 100),
      coalesce((p_document ->> 'is_active')::boolean, true),
      case when coalesce((p_document ->> 'archived')::boolean, false) then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into popup_id;
  else
    popup_id := (p_document ->> 'id')::uuid;
    select to_jsonb(d) into previous_row from public.popup_documents d where d.id = popup_id for update;
    if previous_row is null then raise exception 'popup_not_found' using errcode = 'P0002'; end if;

    update public.popup_documents
    set title = popup_title,
        content_mode = popup_mode,
        content_html = popup_html,
        size = popup_size,
        targets = target_values,
        starts_at = popup_starts_at,
        ends_at = popup_ends_at,
        sort_order = coalesce((p_document ->> 'sort_order')::integer, 100),
        is_active = coalesce((p_document ->> 'is_active')::boolean, true),
        archived_at = case
          when coalesce((p_document ->> 'archived')::boolean, false) then coalesce(archived_at, now())
          else null
        end,
        updated_by = auth.uid()
    where id = popup_id;
  end if;

  select to_jsonb(d) into saved_row from public.popup_documents d where d.id = popup_id;
  insert into public.audit_logs (actor_user_id, action, target_type, target_id, before_data, after_data)
  values (auth.uid(), case when previous_row is null then 'popup.created' else 'popup.updated' end, 'popup_document', popup_id::text, previous_row - 'content_html', saved_row - 'content_html');

  return popup_id;
end;
$$;

revoke all on function public.manage_popup_document(jsonb) from public, anon, authenticated;
grant execute on function public.manage_popup_document(jsonb) to authenticated;

commit;
