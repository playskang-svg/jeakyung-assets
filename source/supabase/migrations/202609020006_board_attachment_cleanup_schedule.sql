-- 첨부파일 정리를 매일 자동으로 돌린다.
--
-- 202609020005 에서 "무엇을 지울지"와 "실제로 지우기"까지는 갖췄지만, 그것을
-- 부르는 것이 관리자의 손밖에 없었다. 여기서 예약 실행을 붙인다.

-- 1. 예약 실행이 자기 자신을 증명할 방법.
--
-- 정리 엣지 함수는 사람(최고관리자)도 부르고 예약 작업도 부른다. 사람은 자기
-- 세션으로 증명하지만 예약 작업에는 세션이 없다. 서비스 역할 키를 DB 에 넣어
-- 두는 방법도 있으나, 그 키 하나면 이 프로젝트의 모든 것을 할 수 있어 정리
-- 작업 하나 때문에 두기에는 위험이 너무 크다. 그래서 이 함수에만 쓰는 무작위
-- 비밀값을 따로 둔다. 새어 나가도 할 수 있는 일은 "지울 것을 지우는 것"뿐이다.
create table if not exists public.internal_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

-- 아무도 읽을 수 없다. service_role 은 RLS 를 지나치므로 엣지 함수만 읽는다.
alter table public.internal_secrets enable row level security;
revoke all on table public.internal_secrets from public, anon, authenticated;

insert into public.internal_secrets(key, value)
values ('board_attachment_cleanup_token', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- 2. 예약 실행에 필요한 확장.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 3. 호출을 한곳에 감싸 둔다. 크론 정의에 URL·키를 늘어놓지 않기 위해서다.
--
-- 주의: pg_net 은 with schema extensions 로 설치해도 함수를 net 스키마에 만든다.
-- extensions.net_http_post 로 부르면 함수가 없다며 매번 실패한다.
--
-- Authorization 의 anon 키는 공개 키다(이미 프런트엔드 번들에 들어 있다).
-- 게이트웨이의 JWT 검사를 지나기 위한 것일 뿐이고, 실제 권한 증명은
-- x-cleanup-token 이 한다.
create or replace function public.run_board_attachment_cleanup()
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare v_token text; v_request_id bigint;
begin
  select value into v_token from public.internal_secrets where key = 'board_attachment_cleanup_token';
  if v_token is null then
    raise exception 'cleanup_token_missing';
  end if;

  select net.http_post(
    url := 'https://vzswlvumcdxnryrfwkkl.supabase.co/functions/v1/board-attachment-cleanup',
    body := jsonb_build_object('dryRun', false),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6c3dsdnVtY2R4bnJ5cmZ3a2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTkxMDcsImV4cCI6MjEwMDg5NTEwN30.rEnX2VV7mGKZXf9Ea9IzaLpfC2AKhq56se669s4pGzQ',
      'x-cleanup-token', v_token
    ),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.run_board_attachment_cleanup() from public, anon, authenticated;

-- 4. 매일 한국 시간 새벽 4시 10분(UTC 19:10)에 돈다. 사람이 거의 쓰지 않는
--    시간대라 삭제가 진행 중인 글과 부딪힐 일이 적다.
select cron.schedule(
  'board-attachment-cleanup-daily',
  '10 19 * * *',
  $cron$select public.run_board_attachment_cleanup();$cron$
);
