-- 대표 이미지를 고르지 않은 글에도 목록 썸네일이 걸리게 한다.
--
-- 주소로 넣은 그림(externalImage)만 있는 글은 cover_attachment_id 가 비어
-- 목록에서 빈 칸으로 남았다. 본문에 처음 나오는 그림을 대신 쓴다.
--
--   1) 글쓴이가 고른 대표 이미지
--   2) 본문에 처음 나오는 올린 그림 — 서명된 주소를 보는 쪽에서 따로 받는다
--   3) 본문에 처음 나오는 주소로 넣은 그림 — 그 주소가 곧 썸네일이다
--
-- get_board_posts 는 크고 여러 곳이 쓰는 함수라 통째로 옮겨 적지 않는다.
-- 살아 있는 정의에서 item 을 만드는 자리 한 곳만 바꿔 넣는다.
do $do$
declare
  src text;
  n text := $a$        'cover_attachment_id',case when public.can_access_board(p.board_id,'attachment_view') then p.cover_attachment_id else null end
      ) item,$a$;
  r text := $a$        'cover_attachment_id',case when public.can_access_board(p.board_id,'attachment_view') then p.cover_attachment_id else null end,
        'inline_attachment_id',case when public.can_access_board(p.board_id,'attachment_view')
          then jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),'$.**?(@.type == "inlineImage").attrs.attachmentId') #>> '{}'
          else null end,
        'external_image_src',jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),'$.**?(@.type == "externalImage").attrs.src') #>> '{}'
      ) item,$a$;
  hits int;
begin
  src := pg_get_functiondef('public.get_board_posts'::regproc);
  if position('external_image_src' in src) > 0 then return; end if;
  hits := (length(src) - length(replace(src, n, ''))) / length(n);
  if hits <> 1 then raise exception 'item 을 만드는 자리를 % 번 찾았다 — 1 번이어야 한다', hits; end if;
  execute replace(src, n, r);
end
$do$;

-- 앨범 띠도 같은 차례로 고르고, 그림이 없으면 유튜브 미리보기를 쓴다.
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
  can_see_files boolean;
begin
  select * into b from public.boards where slug = p_slug;
  -- 게시판을 볼 수 없는 사람에게는 빈 목록을 준다. 예외를 던지면 홈 화면이
  -- 통째로 서지 못한다. 이 띠는 없어도 되는 자리다.
  if b.id is null or not public.can_access_board(b.id, 'list_read') then
    return '[]'::jsonb;
  end if;
  can_see_files := public.can_access_board(b.id, 'attachment_view');

  return coalesce((
    select jsonb_agg(item order by created_at desc)
    from (
      select
        p.created_at,
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'created_at', p.created_at,
          'cover_attachment_id', case when can_see_files then p.cover_attachment_id else null end,
          'inline_attachment_id', case when can_see_files then
            jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),
              '$.**?(@.type == "inlineImage").attrs.attachmentId') #>> '{}' else null end,
          'external_image_src', jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),
            '$.**?(@.type == "externalImage").attrs.src') #>> '{}',
          'youtube_id', jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),
            '$.**?(@.type == "youtubeEmbed").attrs.videoId') #>> '{}'
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
