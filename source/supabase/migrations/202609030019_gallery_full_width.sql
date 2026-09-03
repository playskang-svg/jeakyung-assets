-- 갤러리 게시판을 사진 전용으로 정리한다.
--
--   파일 첨부를 끈다 — 사진을 첨부로도 올리고 본문에도 올리면 어느 쪽이
--   진짜인지 알 수 없고, 목록에 걸 그림도 갈린다. 사진은 본문에만 넣는다.
--   본문 이미지에 '꽉 채우기' 크기를 더한다. 기존 large 는 960px 상한이
--   있어 사진이 주인공인 화면에서는 좁다.
do $do$
declare
  src text;
  n text := $a$not in ('original','small','medium','large','custom')$a$;
  r text := $a$not in ('original','small','medium','large','custom','full')$a$;
  hits int;
begin
  src := pg_get_functiondef('public.validate_board_document'::regproc);
  if position(r in src) > 0 then return; end if;
  hits := (length(src) - length(replace(src, n, ''))) / length(n);
  -- inlineImage 와 externalImage 두 곳에 같은 검사가 있다.
  if hits <> 2 then raise exception '크기 검사를 % 곳에서 찾았다 — 2 곳이어야 한다', hits; end if;
  execute replace(src, n, r);
end
$do$;

update public.boards
set settings = settings || '{"allow_attachments": false}'::jsonb, updated_at = now()
where board_type = 'gallery'
  and coalesce((settings->>'allow_attachments')::boolean, true);
