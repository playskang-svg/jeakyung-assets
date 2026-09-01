-- 게시 시 "본문이 비었는가" 검사가 inlineImage 만 세고 있었다.
-- 주소로 연결한 이미지(externalImage) 하나만 있는 글은 글자가 없으므로
-- 빈 글로 판정되어 post_content_required 로 거부됐다. 화면에는 사진이
-- 멀쩡히 보이는데 저장만 안 되니 원인을 짐작하기 어려운 종류의 오류다.
--
-- save_board_post 는 길고 이 검사 한 줄만 고치면 되므로, 저장소의 옛
-- 마이그레이션에서 함수를 재작성하지 않고 DB 의 현재 정의를 읽어 그 부분만
-- 바꿔 다시 만든다. 재작성했다가 그동안의 다른 수정을 되돌리는 일을 피한다.
do $$
declare
  original text;
  patched text;
  needle  text := 'node->>''type''=''inlineImage''';
  replace_with text := 'node->>''type'' in (''inlineImage'',''externalImage'')';
begin
  select pg_get_functiondef(p.oid) into original
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'save_board_post';

  if original is null then
    raise exception 'save_board_post 를 찾지 못했습니다';
  end if;

  -- 이미 고쳐져 있으면 아무것도 하지 않는다(여러 번 적용해도 안전하게).
  if position(needle in original) = 0 then
    return;
  end if;

  -- 정확히 한 곳이어야 한다. 여러 곳이면 의도치 않은 자리까지 바뀐다.
  if (select count(*) from regexp_matches(original, needle, 'g')) <> 1 then
    raise exception '바꿀 자리가 정확히 1곳이 아닙니다 (%)',
      (select count(*) from regexp_matches(original, needle, 'g'));
  end if;

  patched := replace(original, needle, replace_with);
  execute patched;
end $$;
