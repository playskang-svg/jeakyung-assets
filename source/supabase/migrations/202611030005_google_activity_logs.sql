begin;

-- 그룹웨어에서 jeakyungdrive01 구글 계정으로 만든 문서·일정 기록.
-- Worker(/api/docs, /api/calendar/events)가 작업을 마친 뒤 그 사용자 토큰으로
-- log_google_activity 를 불러 남긴다. 관리자만 읽는다.
create table if not exists public.google_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('doc_create','event_create','event_update','event_delete')),
  title text not null check (char_length(title) between 1 and 300),
  target_id text,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists google_activity_logs_created_idx on public.google_activity_logs(created_at desc);
alter table public.google_activity_logs enable row level security;
revoke all on public.google_activity_logs from anon, authenticated;

create or replace function public.log_google_activity(p_kind text, p_title text, p_target_id text, p_url text)
returns uuid language plpgsql security definer set search_path to 'pg_catalog' as $$
declare result_id uuid;
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  insert into public.google_activity_logs(user_id, kind, title, target_id, url)
  values (auth.uid(), p_kind, left(coalesce(nullif(btrim(p_title),''),'(제목 없음)'),300), p_target_id, p_url)
  returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.admin_get_google_activity_logs(p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id, 'kind', l.kind, 'title', l.title, 'url', l.url, 'created_at', l.created_at,
      'user_name', coalesce(p.name, '(탈퇴 회원)'), 'user_email', p.email) order by l.created_at desc)
    from (select * from public.google_activity_logs order by created_at desc limit least(greatest(coalesce(p_limit,200),1),1000)) l
    left join public.profiles p on p.id=l.user_id), '[]'::jsonb);
end;
$$;

revoke all on function public.log_google_activity(text,text,text,text) from public, anon;
revoke all on function public.admin_get_google_activity_logs(integer) from public, anon;
grant execute on function public.log_google_activity(text,text,text,text) to authenticated;
grant execute on function public.admin_get_google_activity_logs(integer) to authenticated;

commit;
