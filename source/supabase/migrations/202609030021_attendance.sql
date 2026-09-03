-- 출퇴근 기록.
--
-- 규칙은 하나다. 한 번 남긴 시각은 고칠 수 없다. 그래서 이 표에는 UPDATE·DELETE
-- 권한을 아무에게도 주지 않고, 시각을 채우는 일은 아래 두 함수만 한다. 함수는
-- 비어 있는 칸에만 값을 넣으므로 두 번 눌러도 처음 시각이 남는다. 관리자 계정
-- 으로 접속하더라도 방아쇠가 값 바뀌는 것을 막는다.
--
-- 날짜는 한국 시각 기준으로 끊는다. 자정을 넘겨 퇴근하는 경우가 있어 서버가
-- 어느 지역에 있든 같은 하루로 묶이게 해야 한다.

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  constraint attendance_records_one_a_day unique (profile_id, work_date),
  constraint attendance_records_order check (
    checked_out_at is null or checked_in_at is null or checked_out_at >= checked_in_at
  )
);

create index if not exists attendance_records_profile_date_idx
  on public.attendance_records (profile_id, work_date desc);

alter table public.attendance_records enable row level security;

-- 자기 기록만 읽는다. 쓰기 문은 아예 열지 않는다.
drop policy if exists attendance_records_select_own on public.attendance_records;
create policy attendance_records_select_own on public.attendance_records
  for select to authenticated
  using (profile_id = auth.uid());

revoke all on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;

-- 이미 적힌 시각은 누가 무엇으로 접속하든 바뀌지 않는다. 기록을 믿을 수 있게
-- 만드는 것이 이 방아쇠의 전부다.
create or replace function public.attendance_records_guard()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '출퇴근 기록은 지울 수 없습니다.' using errcode = '42501';
  end if;
  if new.profile_id is distinct from old.profile_id or new.work_date is distinct from old.work_date then
    raise exception '출퇴근 기록의 주인과 날짜는 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  if old.checked_in_at is not null and new.checked_in_at is distinct from old.checked_in_at then
    raise exception '출근 시각은 고칠 수 없습니다.' using errcode = '42501';
  end if;
  if old.checked_out_at is not null and new.checked_out_at is distinct from old.checked_out_at then
    raise exception '퇴근 시각은 고칠 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_records_no_edit on public.attendance_records;
create trigger attendance_records_no_edit
  before update or delete on public.attendance_records
  for each row execute function public.attendance_records_guard();

-- 오늘 날짜(한국 시각).
create or replace function public.attendance_today()
returns date
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$ select (now() at time zone 'Asia/Seoul')::date; $$;

-- 출근을 찍는다. 오늘 칸이 없으면 만들고, 이미 출근 시각이 있으면 거절한다.
-- ON CONFLICT ... WHERE 로 한 문장에 끝내 두 번 눌러도 겹치지 않는다.
create or replace function public.punch_in()
returns public.attendance_records
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_row public.attendance_records;
begin
  if not public.is_approved_member() then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  insert into public.attendance_records (profile_id, work_date, checked_in_at)
  values (auth.uid(), public.attendance_today(), now())
  on conflict (profile_id, work_date) do update
    set checked_in_at = excluded.checked_in_at
    where public.attendance_records.checked_in_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception '오늘 출근은 이미 기록되어 있습니다.' using errcode = '23505';
  end if;
  return v_row;
end;
$$;

-- 퇴근을 찍는다. 출근이 없으면 남길 수 없고, 이미 있으면 덮지 않는다.
create or replace function public.punch_out()
returns public.attendance_records
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_row public.attendance_records;
begin
  if not public.is_approved_member() then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  update public.attendance_records
     set checked_out_at = now()
   where profile_id = auth.uid()
     and work_date = public.attendance_today()
     and checked_in_at is not null
     and checked_out_at is null
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
      from public.attendance_records
     where profile_id = auth.uid() and work_date = public.attendance_today();
    if v_row.id is null or v_row.checked_in_at is null then
      raise exception '출근을 먼저 기록해 주세요.' using errcode = '22023';
    end if;
    raise exception '오늘 퇴근은 이미 기록되어 있습니다.' using errcode = '23505';
  end if;
  return v_row;
end;
$$;

-- 내 기록 목록. 기간을 주지 않으면 최근 31일.
create or replace function public.get_my_attendance(p_from date default null, p_to date default null)
returns table (
  work_date date,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  worked_minutes integer
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select a.work_date,
         a.checked_in_at,
         a.checked_out_at,
         case when a.checked_in_at is not null and a.checked_out_at is not null
              then (extract(epoch from a.checked_out_at - a.checked_in_at) / 60)::integer
         end
    from public.attendance_records a
   where a.profile_id = auth.uid()
     and public.is_approved_member()
     and a.work_date between coalesce(p_from, public.attendance_today() - 30)
                         and coalesce(p_to, public.attendance_today())
   order by a.work_date desc;
$$;

grant execute on function public.attendance_today() to authenticated;
grant execute on function public.punch_in() to authenticated;
grant execute on function public.punch_out() to authenticated;
grant execute on function public.get_my_attendance(date, date) to authenticated;
