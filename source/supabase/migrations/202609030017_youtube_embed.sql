-- 본문에 유튜브 영상을 넣을 수 있게 한다.
--
-- 문서에 남기는 것은 주소가 아니라 영상 번호 열한 글자뿐이다. 주소를 통째로
-- 받으면 그 안에 무엇이 들어올지 매번 따져야 하지만, 번호만 받으면 iframe
-- 주소는 우리가 만들어 붙이므로 따질 것이 없다.
--
-- validate_board_document 는 여러 마이그레이션을 거쳐 온 함수라 통째로 옮겨
-- 적지 않는다. 살아 있는 정의에서 세 자리만 바꿔 넣는다.
--   1) 허용 노드 타입 목록
--   2) attrs 를 가질 수 있는 노드 목록
--   3) youtubeEmbed 전용 검사 분기
do $do$
declare
  src text;
  n1 text := $a$'hardBreak','inlineImage','externalImage')$a$;
  r1 text := $a$'hardBreak','inlineImage','externalImage','youtubeEmbed')$a$;
  n2 text := $a$'codeBlock','inlineImage','externalImage') and node ? 'attrs'$a$;
  r2 text := $a$'codeBlock','inlineImage','externalImage','youtubeEmbed') and node ? 'attrs'$a$;
  n3 text := $a$  ) then raise exception 'unsupported_board_document_node'$a$;
  r3 text := $a$      -- 유튜브 영상. 주소가 아니라 영상 번호 열한 글자만 문서에 남긴다.
      or (node->>'type'='youtubeEmbed' and (
        jsonb_typeof(node->'attrs'->'videoId')<>'string'
        or coalesce(node->'attrs'->>'videoId','') !~ '^[A-Za-z0-9_-]{11}$'
        or (node->'attrs' ? 'caption' and jsonb_typeof(node->'attrs'->'caption')<>'string')
        or char_length(coalesce(node->'attrs'->>'caption','')) > 1000
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('videoId','caption'))
      ))
  ) then raise exception 'unsupported_board_document_node'$a$;
begin
  src := pg_get_functiondef('public.validate_board_document'::regproc);
  if position('youtubeEmbed' in src) > 0 then return; end if;
  if (length(src) - length(replace(src, n1, ''))) / length(n1) <> 1 then raise exception '허용 노드 목록을 찾지 못했다'; end if;
  if (length(src) - length(replace(src, n2, ''))) / length(n2) <> 1 then raise exception 'attrs 허용 목록을 찾지 못했다'; end if;
  if (length(src) - length(replace(src, n3, ''))) / length(n3) <> 1 then raise exception '분기를 넣을 자리를 찾지 못했다'; end if;
  execute replace(replace(replace(src, n1, r1), n2, r2), n3, r3);
end
$do$;

-- 대시보드 앨범 띠 전용. get_board_posts 를 건드리지 않으려고 따로 둔다.
-- 목록에 필요한 것만 돌려준다: 대표 이미지와, 본문에 붙은 첫 유튜브 영상 번호.
create or replace function public.get_album_highlights(p_slug text, p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  b public.boards;
  take integer := least(greatest(coalesce(p_limit, 12), 1), 24);
begin
  select * into b from public.boards where slug = p_slug;
  -- 게시판을 볼 수 없는 사람에게는 빈 목록을 준다. 예외를 던지면 홈 화면이
  -- 통째로 서지 못한다. 이 띠는 없어도 되는 자리다.
  if b.id is null or not public.can_access_board(b.id, 'list_read') then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(item order by created_at desc)
    from (
      select
        p.created_at,
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'created_at', p.created_at,
          'cover_attachment_id', p.cover_attachment_id,
          'youtube_id', jsonb_path_query_first(
            coalesce(p.content_document, '{}'::jsonb),
            '$.**?(@.type == "youtubeEmbed").attrs.videoId'
          ) #>> '{}'
        ) as item
      from public.board_posts p
      where p.board_id = b.id
        and p.status = 'published'
        and p.deleted_at is null
      order by p.created_at desc
      limit take
    ) picked
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_album_highlights(text, integer) from public;
grant execute on function public.get_album_highlights(text, integer) to authenticated;
