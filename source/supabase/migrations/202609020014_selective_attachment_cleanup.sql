-- 고른 파일만 지우기 위한 목록.
--
-- 자동 정리(collect_board_attachment_cleanup_targets)는 유예가 지난 것을
-- 스스로 훑는다. 이쪽은 관리자가 화면에서 직접 고른 것만 돌려준다.
--
-- 유예 시간은 보지 않는다. 유예는 실수로 지운 것을 되돌릴 틈을 주려는 것인데,
-- 목록에서 파일을 고르고 한 번 더 확인까지 한 사람에게 다시 기다리라 할 이유가
-- 없다.
--
-- 살아 있는 글이 아직 가리키는 파일은 고르더라도 건너뛴다. 이건 취향이 아니라
-- 글이 깨지는 문제다. 자동 정리와 같은 규칙을 쓴다.
create or replace function public.select_board_attachment_cleanup_targets(p_attachment_ids uuid[])
returns table(kind text, attachment_id uuid, storage_path text, file_size bigint)
language sql stable security definer set search_path to 'pg_catalog'
as $function$
  with referenced as (
    select distinct (node->'attrs'->>'attachmentId')::uuid as attachment_id
    from public.board_posts p,
         lateral jsonb_path_query(coalesce(p.content_document,'{}'::jsonb), '$.**{0 to 20}') as node
    where p.deleted_at is null
      and node->'attrs' ? 'attachmentId'
      and (node->'attrs'->>'attachmentId') ~ '^[0-9a-fA-F-]{36}$'
  )
  select 'attachment'::text, a.id, a.storage_path, a.file_size
  from public.board_attachments a
  where a.id = any(coalesce(p_attachment_ids, '{}'::uuid[]))
    and a.lifecycle_status = 'cleanup_candidate'
    and a.deleted_at is null
    and not exists (select 1 from referenced r where r.attachment_id = a.id)
  order by a.storage_path;
$function$;

revoke all on function public.select_board_attachment_cleanup_targets(uuid[]) from public;
-- 엣지 함수(서비스 역할)만 부른다. 화면에서 직접 부를 일이 없다.

-- 정리 후보 목록에 등록일을 함께 내려준다.
--
-- 여태 '정리 시각(cleanup_after)'만 보냈다. 그 값은 언제 지워질지를 말할 뿐,
-- 이 파일이 언제 올라온 것인지는 알려 주지 않는다. 목록에서 무엇을 지울지
-- 고르려면 올라온 때를 봐야 한다.
--
-- 한 번에 보여 주는 개수도 20 → 50 으로 늘린다. 목록에 없는 것은 고를 수도
-- 없어서, 스무 개를 넘기면 나머지는 자동 정리를 기다리는 수밖에 없었다.
create or replace function public.get_admin_file_cleanup_details()
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog'
as $function$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'largest_file',(
      select jsonb_build_object('original_name',a.original_name,'file_size',a.file_size,'purpose',a.purpose,'board_name',b.name,'created_at',a.created_at)
      from public.board_attachments a join public.boards b on b.id=a.board_id
      where a.deleted_at is null
      order by a.file_size desc,a.created_at desc limit 1
    ),
    'cleanup_candidates',coalesce((
      select jsonb_agg(jsonb_build_object('id',item.id,'original_name',item.original_name,'file_size',item.file_size,'purpose',item.purpose,'board_name',item.board_name,'cleanup_after',item.cleanup_after,'created_at',item.created_at) order by item.cleanup_after nulls last,item.file_size desc)
      from (
        select a.id,a.original_name,a.file_size,a.purpose,b.name board_name,a.cleanup_after,a.created_at
        from public.board_attachments a join public.boards b on b.id=a.board_id
        where a.deleted_at is null and a.lifecycle_status='cleanup_candidate'
        order by a.cleanup_after nulls last,a.file_size desc limit 50
      ) item
    ),'[]'::jsonb)
  );
end;
$function$;
