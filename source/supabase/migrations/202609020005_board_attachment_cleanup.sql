-- 지운 첨부파일을 실제로 없애기 위한 두 함수.
--
-- 저장소 행(storage.objects)만 지우면 S3 안의 파일은 그대로 남는다. 그래서
-- 실제 삭제는 Storage API 를 쓸 수 있는 엣지 함수(board-attachment-cleanup)가
-- 하고, 여기서는 "무엇을 지울지"만 정한다. 판단을 SQL 에 두는 이유는 참조
-- 검사를 DB 가 가장 정확히 할 수 있기 때문이다.

-- 지울 대상을 고른다.
--   attachment  — 지움 표시가 되고 유예 기간(cleanup_after)이 지난 첨부
--   orphan      — 저장소에는 있는데 board_attachments 에 기록이 아예 없는 파일
--                 (등록 직전에 실패한 업로드). 갓 올라온 파일을 잡지 않도록
--                 하루가 지난 것만 본다.
--
-- 안전장치: 살아 있는 글 본문이 아직 가리키고 있는 첨부는 유예 기간이 지났어도
-- 건너뛴다. lifecycle_status 가 잘못 붙어도 보이는 이미지가 깨지지 않게 한다.
create or replace function public.collect_board_attachment_cleanup_targets(p_limit integer default 200)
returns table(kind text, attachment_id uuid, storage_path text, file_size bigint)
language sql
stable
security definer
set search_path to 'pg_catalog'
as $function$
  with referenced as (
    select distinct (node->'attrs'->>'attachmentId')::uuid as attachment_id
    from public.board_posts p,
         lateral jsonb_path_query(coalesce(p.content_document,'{}'::jsonb), '$.**{0 to 20}') as node
    where p.deleted_at is null
      and node->'attrs' ? 'attachmentId'
      and (node->'attrs'->>'attachmentId') ~ '^[0-9a-fA-F-]{36}$'
  ),
  candidates as (
    select 'attachment'::text as kind, a.id as attachment_id, a.storage_path, a.file_size
    from public.board_attachments a
    where a.lifecycle_status = 'cleanup_candidate'
      and a.deleted_at is null
      and a.cleanup_after is not null
      and a.cleanup_after <= now()
      and not exists (select 1 from referenced r where r.attachment_id = a.id)
    union all
    select 'orphan'::text, null::uuid, o.name, coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
    where o.bucket_id = 'groupware-board-attachments'
      and o.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.board_attachments a where a.storage_path = o.name)
  )
  select kind, attachment_id, storage_path, file_size
  from candidates
  order by kind, storage_path
  limit greatest(coalesce(p_limit, 200), 1);
$function$;

-- 파일을 실제로 지운 뒤 호출한다. 저장소에서 사라진 것만 기록에 반영한다.
create or replace function public.finalize_board_attachment_cleanup(p_attachment_ids uuid[])
returns integer
language sql
security definer
set search_path to 'pg_catalog'
as $function$
  with done as (
    update public.board_attachments
    set deleted_at = now(), lifecycle_status = 'deleted'
    where id = any(coalesce(p_attachment_ids, '{}'::uuid[]))
      and deleted_at is null
    returning 1
  )
  select count(*)::integer from done;
$function$;

-- 두 함수 모두 서비스 역할(엣지 함수)만 쓴다. 일반 사용자가 부를 이유가 없다.
revoke all on function public.collect_board_attachment_cleanup_targets(integer) from public, anon, authenticated;
revoke all on function public.finalize_board_attachment_cleanup(uuid[]) from public, anon, authenticated;
grant execute on function public.collect_board_attachment_cleanup_targets(integer) to service_role;
grant execute on function public.finalize_board_attachment_cleanup(uuid[]) to service_role;
