-- 이미지 옆으로 글이 흐를 수 있게 flow 속성을 연다.
--
-- 지금까지 본문 이미지는 항상 한 줄을 통째로 차지했다. 사진 옆에 설명을 붙이고
-- 싶어도 위나 아래로만 갈 수 있었다. flow='wrap' 이면 이미지가 좌우 한쪽에
-- 붙고 글이 그 옆을 타고 흐른다.
--
--   block  기존 동작. 이미지가 한 줄을 차지한다(기본값)
--   wrap   이미지가 alignment 쪽에 붙고 글이 옆으로 흐른다
--
-- alignment 는 그대로 쓴다. wrap 일 때 left/right 는 어느 쪽에 붙일지를 뜻하고,
-- center 는 옆으로 흐를 자리가 없으므로 화면 쪽에서 block 처럼 다룬다.
-- 좁은 화면에서도 화면 쪽에서 블록으로 되돌린다 - 글이 두세 글자씩 끊기기 때문.
--
-- 없어도 되는 속성이므로 기존 문서는 손대지 않는다. flow 키가 없으면 block 이다.
--
-- 함수가 길고 고칠 곳은 두 노드의 속성 검사뿐이라, 저장소의 옛 마이그레이션에서
-- 재작성하지 않고 DB 의 현재 정의를 읽어 그 부분만 바꿔 다시 만든다.
do $$
declare
  original text;
  patched  text;
begin
  select pg_get_functiondef(p.oid) into original
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'validate_board_document';

  if original is null then
    raise exception 'validate_board_document 를 찾지 못했습니다';
  end if;

  -- 이미 적용돼 있으면 아무것도 하지 않는다(여러 번 적용해도 안전하게).
  if position('''flow''' in original) > 0 then
    return;
  end if;

  patched := original;

  patched := replace(patched,
    'key not in (''attachmentId'',''alt'',''caption'',''alignment'',''size'',''width'')',
    'key not in (''attachmentId'',''alt'',''caption'',''alignment'',''size'',''width'',''flow'')');
  patched := replace(patched,
    'key not in (''src'',''alt'',''caption'',''alignment'',''size'',''width'')',
    'key not in (''src'',''alt'',''caption'',''alignment'',''size'',''width'',''flow'')');

  patched := replace(patched,
    'or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->''attrs'')=''object'' then node->''attrs'' else ''{}''::jsonb end) key where key not in (''attachmentId'',''alt'',''caption'',''alignment'',''size'',''width'',''flow''))',
    'or (node->''attrs'' ? ''flow'' and jsonb_typeof(node->''attrs''->''flow'')<>''string'')'
    || ' or coalesce(node->''attrs''->>''flow'',''block'') not in (''block'',''wrap'')'
    || ' or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->''attrs'')=''object'' then node->''attrs'' else ''{}''::jsonb end) key where key not in (''attachmentId'',''alt'',''caption'',''alignment'',''size'',''width'',''flow''))');
  patched := replace(patched,
    'or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->''attrs'')=''object'' then node->''attrs'' else ''{}''::jsonb end) key where key not in (''src'',''alt'',''caption'',''alignment'',''size'',''width'',''flow''))',
    'or (node->''attrs'' ? ''flow'' and jsonb_typeof(node->''attrs''->''flow'')<>''string'')'
    || ' or coalesce(node->''attrs''->>''flow'',''block'') not in (''block'',''wrap'')'
    || ' or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->''attrs'')=''object'' then node->''attrs'' else ''{}''::jsonb end) key where key not in (''src'',''alt'',''caption'',''alignment'',''size'',''width'',''flow''))');

  if patched = original then
    raise exception '치환이 하나도 일어나지 않았습니다 - 함수 본문이 예상과 다릅니다';
  end if;

  execute patched;
end $$;
