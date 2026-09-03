-- 직급(position)을 선택 항목으로 바꾼다.
--
-- 부서·직책은 조직도의 뼈대라 그대로 필수로 두지만, 직급은 없는 사람이 있다.
-- 없다고 계정을 못 만드는 것은 곤란하다. profiles.position_id 는 원래
-- nullable 이었고, 막고 있던 것은 두 함수의 검사뿐이었다.
--
-- 입사일과 사번은 요청대로 계속 필수다(approve_membership 의 별도 검사).
--
-- 함수 전체를 여기에 다시 적지 않고, 살아 있는 정의에서 검사 한 줄만
-- 바꿔 넣는다. 두 함수는 이 파일 말고도 여러 마이그레이션을 거쳐 왔기 때문에,
-- 통째로 옮겨 적으면 그 사이의 변경을 되돌릴 위험이 있다.
do $do$
declare
  r record;
  needle text := 'not exists(select 1 from public.positions where id=p_position_id and is_active)';
  repl   text := '(p_position_id is not null and not exists(select 1 from public.positions where id=p_position_id and is_active))';
  src text; n int; touched text[] := array[]::text[];
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in ('approve_membership','update_employee_profile')
  loop
    src := pg_get_functiondef(r.oid);
    -- 이미 고쳐진 정의는 needle 이 repl 안에 들어 있어 그대로 잡힌다.
    -- 그래서 바뀐 형태가 있으면 건너뛴다(여러 번 실행해도 안전하게).
    if position(repl in src) > 0 then continue; end if;
    n := (length(src) - length(replace(src, needle, ''))) / length(needle);
    if n = 0 then continue; end if;
    if n <> 1 then
      raise exception '% 안에서 검사 구문을 % 번 찾았다 — 1 번이어야 한다', r.proname, n;
    end if;
    execute replace(src, needle, repl);
    touched := touched || r.proname;
  end loop;
  raise notice '직급 선택 허용으로 바꾼 함수: %', touched;
end
$do$;
