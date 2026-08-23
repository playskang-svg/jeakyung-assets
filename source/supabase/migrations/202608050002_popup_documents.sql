begin;

create table public.popup_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  content_mode text not null default 'editor' check (content_mode in ('editor','html')),
  content_html text not null check (char_length(content_html) between 1 and 200000),
  targets text[] not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint popup_documents_period check (ends_at is null or ends_at > starts_at),
  constraint popup_documents_targets check (
    cardinality(targets) > 0
    and targets <@ array[
      'groupware_all','groupware_dashboard','groupware_boards','groupware_approval','groupware_admin',
      'public_all','public_home','public_privacy'
    ]::text[]
  )
);

create index popup_documents_delivery_idx
  on public.popup_documents (is_active, starts_at, ends_at, sort_order)
  where archived_at is null;

create trigger popup_documents_set_updated_at
before update on public.popup_documents
for each row execute function public.set_updated_at();

alter table public.popup_documents enable row level security;

create or replace function public.get_active_popup_documents(p_target text)
returns table (
  id uuid,
  title text,
  content_mode text,
  content_html text,
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
  select d.id, d.title, d.content_mode, d.content_html, d.starts_at, d.ends_at
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

create or replace function public.get_popup_admin_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.archived_at nulls first, d.sort_order, d.created_at desc)
      from public.popup_documents d
    ), '[]'::jsonb)
  );
end;
$$;

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
  popup_starts_at timestamptz;
  popup_ends_at timestamptz;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  if char_length(popup_title) not between 1 and 120 then
    raise exception 'invalid_popup_title' using errcode = '22023';
  end if;
  if popup_mode not in ('editor','html') then
    raise exception 'invalid_popup_content_mode' using errcode = '22023';
  end if;
  if char_length(popup_html) not between 1 and 200000 then
    raise exception 'invalid_popup_content' using errcode = '22023';
  end if;
  if popup_html ~* '<\s*(script|iframe|object|embed|form|input|button|meta|link|base)(\s|>)'
     or popup_html ~* '\son[a-z]+\s*='
     or popup_html ~* '(javascript|vbscript):' then
    raise exception 'unsafe_popup_html' using errcode = '22023';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
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
      title, content_mode, content_html, targets, starts_at, ends_at, sort_order,
      is_active, archived_at, created_by, updated_by
    ) values (
      popup_title, popup_mode, popup_html, target_values, popup_starts_at, popup_ends_at,
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

insert into public.popup_documents (
  title, content_mode, content_html, targets, starts_at, ends_at, sort_order, is_active
)
select
  '재경닷컴 그룹웨어 이용 안내',
  'editor',
  $guide$
    <h2>재경닷컴 그룹웨어에 오신 것을 환영합니다.</h2>
    <p>왼쪽 메뉴에서 필요한 업무를 선택할 수 있습니다. 모바일에서는 상단 메뉴 버튼을 눌러 전체 메뉴를 확인하세요.</p>
    <h3>빠른 이용 방법</h3>
    <ul>
      <li><strong>대시보드</strong>: 내 프로필과 주요 업무 현황을 확인합니다.</li>
      <li><strong>게시판</strong>: 권한이 부여된 게시판을 읽고 글과 댓글을 작성합니다.</li>
      <li><strong>전자결재</strong>: 기안 작성, 결재 대기, 진행 문서와 완료 문서를 확인합니다.</li>
      <li><strong>조직도</strong>: 임직원의 부서와 직책 정보를 확인합니다.</li>
      <li><strong>관리자</strong>: 회원·조직·게시판·팝업 문서를 관리합니다.</li>
    </ul>
    <p>화면 오른쪽 위 계정 메뉴에서 현재 역할과 내 프로필을 확인할 수 있습니다.</p>
  $guide$,
  array['groupware_all']::text[],
  now(),
  null,
  10,
  true
where not exists (
  select 1 from public.popup_documents where title = '재경닷컴 그룹웨어 이용 안내'
);

revoke all on table public.popup_documents from public, anon, authenticated;
revoke all on function public.get_active_popup_documents(text) from public, anon, authenticated;
revoke all on function public.get_popup_admin_catalog() from public, anon, authenticated;
revoke all on function public.manage_popup_document(jsonb) from public, anon, authenticated;

grant execute on function public.get_active_popup_documents(text) to anon, authenticated;
grant execute on function public.get_popup_admin_catalog() to authenticated;
grant execute on function public.manage_popup_document(jsonb) to authenticated;

commit;
