-- 접속 현황과 관리자 전용 조회 화면.
--
-- "지금 접속해 있다"는 로그인 이벤트가 아니라 하트비트다. 화면이 열려 있는
-- 동안 클라이언트가 주기적으로 touch_presence() 를 부르고, 그 시각이 최근이면
-- 접속 중으로 본다. 소켓을 열어 두는 방식(Realtime Presence)보다 훨씬 단순하고,
-- 탭을 그냥 닫아도(로그아웃 신호 없이도) 몇 분 뒤 자연히 "접속 중"에서 빠진다.
--
-- 로그인 이력(login_events)은 하트비트와 별개로 남는다 — 접속 중 표시는
-- 지워져도, 관리자가 나중에 "이 사람이 언제 들어왔었나"를 볼 수 있어야 한다.

-- 지금 접속해 있는지 판단하는 기준. 한 곳에 모아 두어 하트비트 간격을 바꿀 때
-- 여러 함수를 따로 고치지 않게 한다.
create or replace function public.presence_online_window()
returns interval
language sql
immutable
set search_path to 'pg_catalog'
as $$ select interval '3 minutes'; $$;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  signed_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text
);

create index if not exists login_events_profile_idx on public.login_events (profile_id, signed_in_at desc);

alter table public.login_events enable row level security;

-- 본인 접속 이력만 읽는다. 다른 사람 것은 관리자 전용 함수(get_member_login_events)
-- 로만 본다 — 그 함수는 SECURITY DEFINER 라 이 정책을 우회해 관리자 확인을
-- 직접 한다.
drop policy if exists login_events_select_own on public.login_events;
create policy login_events_select_own on public.login_events
  for select to authenticated
  using (profile_id = auth.uid());

revoke all on public.login_events from anon, authenticated;
grant select on public.login_events to authenticated;

-- 하트비트. 로그인 직후와 그 뒤 주기적으로(수 분 간격) 부른다.
-- 최근 하트비트가 있으면 그 접속이 이어지는 것으로 보아 이력 한 줄의 시각만
-- 올리고, 끊긴 지 오래됐으면(브라우저를 닫았다가 새로 열었으면) 새 줄을 만든다.
create or replace function public.touch_presence(p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_open_id uuid;
  v_open_last_seen timestamptz;
begin
  if not public.is_approved_member() then return; end if;

  update public.profiles set last_seen_at = now() where id = auth.uid();

  select id, last_seen_at into v_open_id, v_open_last_seen
    from public.login_events
   where profile_id = auth.uid()
   order by signed_in_at desc
   limit 1;

  if v_open_id is not null and v_open_last_seen > now() - public.presence_online_window() * 4 then
    update public.login_events set last_seen_at = now() where id = v_open_id;
  else
    insert into public.login_events (profile_id, user_agent) values (auth.uid(), p_user_agent);
  end if;
end;
$$;

-- 지금 접속해 있는 사람. 본인도 포함한다 — "나도 접속 중"이 이 창에서 보여야
-- 화면이 살아 있다는 것을 알 수 있다.
create or replace function public.get_online_profiles()
returns table (profile_id uuid, display_name text, department_name text, is_me boolean)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select p.id as profile_id,
         coalesce(nullif(p.preferred_name, ''), p.full_name, p.name) as display_name,
         d.name as department_name,
         p.id = auth.uid() as is_me
    from public.profiles p
    left join public.departments d on d.id = p.department_id
   where public.is_approved_member()
     and p.membership_status = 'approved'
     and p.last_seen_at > now() - public.presence_online_window()
   order by is_me desc, display_name;
$$;

-- 관리자: 회원별 접속(로그인) 이력.
create or replace function public.get_member_login_events(p_profile_id uuid, p_limit integer default 50)
returns table (signed_in_at timestamptz, last_seen_at timestamptz, user_agent text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode = '42501'; end if;
  return query
    select e.signed_in_at, e.last_seen_at, e.user_agent
      from public.login_events e
     where e.profile_id = p_profile_id
     order by e.signed_in_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- 관리자: 회원 목록과 접속 요약(지금 접속 중인지, 마지막으로 살아 있던 시각,
-- 가장 최근 로그인) — 목록에서 회원을 고르면 위 함수로 그 사람의 이력을 본다.
create or replace function public.get_member_login_summary()
returns table (
  profile_id uuid, display_name text, department_name text, employee_number text,
  last_seen_at timestamptz, last_signed_in_at timestamptz, is_online boolean
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode = '42501'; end if;
  return query
    select p.id as profile_id,
           coalesce(nullif(p.preferred_name, ''), p.full_name, p.name) as display_name,
           d.name as department_name,
           p.employee_number,
           p.last_seen_at,
           (select max(e.signed_in_at) from public.login_events e where e.profile_id = p.id) as last_signed_in_at,
           coalesce(p.last_seen_at > now() - public.presence_online_window(), false) as is_online
      from public.profiles p
      left join public.departments d on d.id = p.department_id
     where p.membership_status = 'approved'
     order by is_online desc, p.last_seen_at desc nulls last, display_name;
end;
$$;

-- 관리자: 전체 회원 출퇴근 기록. 회원을 지정하지 않으면 전체, 기간을 주지
-- 않으면 최근 31일.
create or replace function public.get_member_attendance(
  p_profile_id uuid default null, p_from date default null, p_to date default null, p_limit integer default 500
)
returns table (
  profile_id uuid, display_name text, department_name text, work_date date,
  checked_in_at timestamptz, checked_out_at timestamptz, worked_minutes integer
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode = '42501'; end if;
  return query
    select a.profile_id,
           coalesce(nullif(p.preferred_name, ''), p.full_name, p.name) as display_name,
           d.name as department_name,
           a.work_date, a.checked_in_at, a.checked_out_at,
           case when a.checked_in_at is not null and a.checked_out_at is not null
                then (extract(epoch from a.checked_out_at - a.checked_in_at) / 60)::integer
           end as worked_minutes
      from public.attendance_records a
      join public.profiles p on p.id = a.profile_id
      left join public.departments d on d.id = p.department_id
     where (p_profile_id is null or a.profile_id = p_profile_id)
       and a.work_date between coalesce(p_from, public.attendance_today() - 30)
                           and coalesce(p_to, public.attendance_today())
     order by a.work_date desc, display_name
     limit least(greatest(coalesce(p_limit, 500), 1), 2000);
end;
$$;

grant execute on function public.presence_online_window() to authenticated;
grant execute on function public.touch_presence(text) to authenticated;
grant execute on function public.get_online_profiles() to authenticated;
grant execute on function public.get_member_login_events(uuid, integer) to authenticated;
grant execute on function public.get_member_login_summary() to authenticated;
grant execute on function public.get_member_attendance(uuid, date, date, integer) to authenticated;
