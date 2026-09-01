-- 본문에 "주소로 연결한 이미지"를 넣을 수 있게 한다.
--
-- 지금까지 본문 이미지는 반드시 우리 저장소에 올린 첨부(inlineImage)여야 했다.
-- 이미 인터넷에 있는 이미지를 넣으려면 내려받아 다시 올리는 수밖에 없었다.
-- externalImage 노드를 새로 허용해 주소만으로 본문에 표시할 수 있게 한다.
--
-- 파일을 우리가 갖고 있지 않으므로 src 검사가 이 노드의 전부다:
--   https 로 시작하는 주소만 받는다
--     http  → 브라우저가 혼합 콘텐츠로 막으므로 넣어 봐야 안 보인다
--     data: → 본문에 임의 내용을 통째로 심는 통로가 된다
--     javascript: → 말할 것도 없다
--   길이 2000자 제한(link mark 와 같은 기준)
--
-- 정렬·크기 속성은 inlineImage 와 똑같이 둔다. 화면에서 같은 CSS 를 쓰므로
-- 좁은 화면에서 줄어드는 동작도 그대로 따라간다.
--
-- 원본이 사라지면 이미지가 깨진다. 이는 "주소만 연결" 방식의 성질이며,
-- 화면 쪽에서 깨진 경우 안내 문구로 대체한다.

begin;

create or replace function public.validate_board_document(p_document jsonb)
returns void language plpgsql stable set search_path to 'pg_catalog' as $function$
declare
  image_count integer;
  distinct_image_count integer;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' or p_document->>'type' <> 'doc' then
    raise exception 'invalid_board_document' using errcode='22023';
  end if;
  if pg_column_size(p_document) > 2097152 then
    raise exception 'board_document_too_large' using errcode='22023';
  end if;

  with recursive nodes(node) as (
    select p_document
    union all
    select child.value
    from nodes parent
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end
    ) child
  )
  select
    count(*) filter (where node->>'type'='inlineImage'),
    count(distinct node->'attrs'->>'attachmentId') filter (where node->>'type'='inlineImage')
  into image_count, distinct_image_count
  from nodes;

  if image_count > 20 then raise exception 'inline_image_limit_exceeded' using errcode='22023'; end if;
  if image_count <> distinct_image_count then raise exception 'duplicate_inline_attachment' using errcode='22023'; end if;

  if exists(
    with recursive nodes(node) as (
      select p_document
      union all
      select child.value from nodes parent
      cross join lateral jsonb_array_elements(case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end) child
    )
    select 1 from nodes
    where jsonb_typeof(node) <> 'object'
      or coalesce(node->>'type','') not in ('doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule','hardBreak','inlineImage','externalImage')
      or (node ? 'content' and jsonb_typeof(node->'content') <> 'array')
      or (node ? 'attrs' and jsonb_typeof(node->'attrs') <> 'object')
      or (node ? 'marks' and jsonb_typeof(node->'marks') <> 'array')
      or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node)='object' then node else '{}'::jsonb end) key where key not in ('type','content','attrs','marks','text'))
      or (node->>'type'='text' and (not node ? 'text' or jsonb_typeof(node->'text') <> 'string'))
      or (node->>'type'<>'text' and node ? 'text')
      or (node->>'type'<>'text' and node ? 'marks')
      or (node->>'type'='doc' and node <> p_document)
      or (node->>'type'='paragraph' and exists(
        select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key <> 'textAlign'
      ))
      or (node->>'type' in ('paragraph','heading') and node->'attrs' ? 'textAlign'
        and node->'attrs'->'textAlign' <> 'null'::jsonb
        and coalesce(node->'attrs'->>'textAlign','') not in ('left','center','right','justify'))
      or (node->>'type'='heading' and (
        jsonb_typeof(node->'attrs'->'level')<>'number'
        or
        coalesce(node->'attrs'->>'level','') !~ '^[1-3]$'
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('level','textAlign'))
      ))
      or (node->>'type'='orderedList' and (
        jsonb_typeof(node->'attrs'->'start')<>'number'
        or (node->'attrs' ? 'type' and node->'attrs'->'type'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'type')<>'string')
        or
        coalesce(node->'attrs'->>'start','') !~ '^[1-9][0-9]{0,5}$'
        or (node->'attrs' ? 'type' and node->'attrs'->>'type' is not null and node->'attrs'->>'type' not in ('1','a','A','i','I'))
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('start','type'))
      ))
      or (node->>'type'='codeBlock' and (
        (node->'attrs' ? 'language' and node->'attrs'->'language'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'language')<>'string')
        or
        (node->'attrs' ? 'language' and node->'attrs'->>'language' is not null and coalesce(node->'attrs'->>'language','') !~ '^[a-zA-Z0-9_+#.-]{1,40}$')
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key<>'language')
      ))
      or (node->>'type' not in ('paragraph','heading','orderedList','codeBlock','inlineImage','externalImage') and node ? 'attrs' and node->'attrs'<>'{}'::jsonb)
      or (node->>'type'='inlineImage' and (
        jsonb_typeof(node->'attrs'->'attachmentId')<>'string'
        or (node->'attrs' ? 'alt' and jsonb_typeof(node->'attrs'->'alt')<>'string')
        or (node->'attrs' ? 'caption' and jsonb_typeof(node->'attrs'->'caption')<>'string')
        or (node->'attrs' ? 'alignment' and jsonb_typeof(node->'attrs'->'alignment')<>'string')
        or (node->'attrs' ? 'size' and jsonb_typeof(node->'attrs'->'size')<>'string')
        or (node->'attrs' ? 'width' and node->'attrs'->'width'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'width')<>'number')
        or coalesce(node->'attrs'->>'attachmentId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or coalesce(node->'attrs'->>'alignment','center') not in ('left','center','right')
        or coalesce(node->'attrs'->>'size','medium') not in ('original','small','medium','large','custom')
        or (node->'attrs' ? 'width' and node->'attrs'->>'width' is not null and (
          case when node->'attrs'->>'width' ~ '^[0-9]{2,4}$' then (node->'attrs'->>'width')::integer not between 80 and 2560 else true end
        ))
        or char_length(coalesce(node->'attrs'->>'alt','')) > 500
        or char_length(coalesce(node->'attrs'->>'caption','')) > 1000
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('attachmentId','alt','caption','alignment','size','width'))
      ))
      -- 주소로 연결한 본문 이미지. 파일은 우리 저장소에 없고 src 만 문서에 남는다.
      -- 그래서 src 검사가 이 노드의 전부다. https 만 받는다. http 는 브라우저가
      -- 어차피 혼합 콘텐츠로 막고, data:/javascript: 는 본문에 스크립트를 심는 통로다.
      or (node->>'type'='externalImage' and (
        jsonb_typeof(node->'attrs'->'src')<>'string'
        or coalesce(node->'attrs'->>'src','') !~* '^https://'
        or char_length(coalesce(node->'attrs'->>'src','')) > 2000
        or (node->'attrs' ? 'alt' and jsonb_typeof(node->'attrs'->'alt')<>'string')
        or (node->'attrs' ? 'caption' and jsonb_typeof(node->'attrs'->'caption')<>'string')
        or (node->'attrs' ? 'alignment' and jsonb_typeof(node->'attrs'->'alignment')<>'string')
        or (node->'attrs' ? 'size' and jsonb_typeof(node->'attrs'->'size')<>'string')
        or (node->'attrs' ? 'width' and node->'attrs'->'width'<>'null'::jsonb and jsonb_typeof(node->'attrs'->'width')<>'number')
        or coalesce(node->'attrs'->>'alignment','center') not in ('left','center','right')
        or coalesce(node->'attrs'->>'size','medium') not in ('original','small','medium','large','custom')
        or (node->'attrs' ? 'width' and node->'attrs'->>'width' is not null and (
          case when node->'attrs'->>'width' ~ '^[0-9]{2,4}$' then (node->'attrs'->>'width')::integer not between 80 and 2560 else true end
        ))
        or char_length(coalesce(node->'attrs'->>'alt','')) > 500
        or char_length(coalesce(node->'attrs'->>'caption','')) > 1000
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(node->'attrs')='object' then node->'attrs' else '{}'::jsonb end) key where key not in ('src','alt','caption','alignment','size','width'))
      ))
  ) then raise exception 'unsupported_board_document_node' using errcode='22023'; end if;

  if exists(
    with recursive nodes(node) as (
      select p_document
      union all
      select child.value from nodes parent
      cross join lateral jsonb_array_elements(case when jsonb_typeof(parent.node->'content')='array' then parent.node->'content' else '[]'::jsonb end) child
    )
    select 1 from nodes n
    cross join lateral jsonb_array_elements(case when jsonb_typeof(n.node->'marks')='array' then n.node->'marks' else '[]'::jsonb end) mark(value)
    where jsonb_typeof(mark.value) <> 'object'
      or coalesce(mark.value->>'type','') not in ('bold','italic','strike','code','underline','link','highlight','textStyle')
      or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(mark.value)='object' then mark.value else '{}'::jsonb end) key where key not in ('type','attrs'))
      or (mark.value ? 'attrs' and jsonb_typeof(mark.value->'attrs') <> 'object')
      -- 서식만 지정하는 mark는 속성을 가지지 않는다
      or (mark.value->>'type' in ('bold','italic','strike','code','underline')
          and mark.value ? 'attrs' and mark.value->'attrs' <> '{}'::jsonb)
      or (mark.value->>'type'='link' and (
        coalesce(mark.value->'attrs'->>'href','') !~* '^https?://'
        or char_length(coalesce(mark.value->'attrs'->>'href','')) > 2000
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(mark.value->'attrs')='object' then mark.value->'attrs' else '{}'::jsonb end) key where key not in ('href','target','rel','class'))
      ))
      or (mark.value->>'type'='highlight' and (
        (mark.value->'attrs' ? 'color' and mark.value->'attrs'->'color' <> 'null'::jsonb
          and coalesce(mark.value->'attrs'->>'color','') !~* '^#[0-9a-f]{3,8}$')
        or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(mark.value->'attrs')='object' then mark.value->'attrs' else '{}'::jsonb end) key where key <> 'color')
      ))
      or (mark.value->>'type'='textStyle' and (
        exists(select 1 from jsonb_object_keys(case when jsonb_typeof(mark.value->'attrs')='object' then mark.value->'attrs' else '{}'::jsonb end) key
               where key not in ('color','backgroundColor','fontSize','fontFamily','lineHeight'))
        or exists(
          select 1 from jsonb_each(case when jsonb_typeof(mark.value->'attrs')='object' then mark.value->'attrs' else '{}'::jsonb end) attr(key, value)
          where attr.value <> 'null'::jsonb and (
            jsonb_typeof(attr.value) <> 'string'
            or (attr.key in ('color','backgroundColor') and coalesce(attr.value #>> '{}','') !~* '^#[0-9a-f]{3,8}$')
            or char_length(coalesce(attr.value #>> '{}','')) > 60
          )
        )
      ))
  ) then raise exception 'unsupported_board_document_mark' using errcode='22023'; end if;
end;
$function$;

commit;
