begin;

-- 버그: 게시글을 읽을 수 있는(list_read/detail_read) 사람에게도, 본문에 박힌
-- 이미지(inlineImage)와 목록 썸네일은 attachment_view 라는 별도 권한이 없으면
-- 보이지 않았다. "이미지를 표시할 수 없습니다" 자리표시자만 남고, 목록 썸네일도
-- 비었다.
--
-- 첨부파일(내려받는 실제 파일, general_attachment)과 달리 본문 이미지는 글
-- 내용 그 자체다 - 글을 읽을 수 있으면 당연히 보여야 한다. 그런데 게시판
-- 관리자 화면(BoardBuilderPanel)의 단순 "읽기" 체크박스는 attachment_view 를
-- 같이 켜 주지만, "고급 권한 설정"에서는 애초에 attachment_view 를 고를 수
-- 없다(첨부 관련 action 은 읽기/쓰기 체크박스 전용이라 목록에서 빼 둠). 이
-- 화면이 생기기 전(다른 방식)으로 만들어졌거나, 다른 경로로 권한 규칙이
-- 어긋난 게시판은 "글은 읽히는데 사진만 깨지는" 상태에 빠질 수 있었다.
--
-- 고쳐서: 본문 이미지(inlineImage)와 목록/앨범 썸네일은 list_read/detail_read
-- 만으로 보이게 한다. 첨부파일(general_attachment, 실제 내려받는 파일)은
-- 지금처럼 attachment_view + attachment_download 를 그대로 요구한다 - 내려받기는
-- 성격이 다르므로 그대로 둔다.

-- 1) 에디터 미리보기 · 본문 이미지 확대 보기가 함께 쓰는 단일 첨부 조회
create or replace function public.get_board_attachment_path(p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$
declare a public.board_attachments;
begin
  select * into a from public.board_attachments
  where id=p_attachment_id and deleted_at is null
    and (lifecycle_status='active' or (lifecycle_status='pending' and uploaded_by=auth.uid()));
  if a.id is null or not exists(select 1 from public.board_posts p where p.id=a.post_id and p.deleted_at is null and p.status<>'deleted' and (p.status<>'draft' or p.author_user_id=auth.uid() or public.can_access_board(p.board_id,'other_post_update')))
    or not public.can_access_board(a.board_id,'detail_read')
    or (a.purpose='general_attachment' and not (public.can_access_board(a.board_id,'attachment_view') and public.can_access_board(a.board_id,'attachment_download'))) then
    raise exception 'attachment_access_denied' using errcode='42501';
  end if;
  return jsonb_build_object('storage_path',a.storage_path,'original_name',a.original_name,'mime_type',a.mime_type,'purpose',a.purpose);
end;
$function$;

-- 2) 저장소 서명 URL 발급이 실제로 통과해야 하는 SELECT 정책의 근거 함수
create or replace function public.can_read_board_attachment_path(p_storage_path text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select
    (string_to_array(p_storage_path, '/'))[2] = auth.uid()::text
    or exists(
      select 1 from public.board_attachments a join public.board_posts p on p.id=a.post_id
      where a.storage_path=p_storage_path and a.deleted_at is null and a.lifecycle_status='active' and p.deleted_at is null and p.status<>'deleted'
        and (p.status<>'draft' or p.author_user_id=auth.uid() or public.can_access_board(p.board_id,'other_post_update'))
        and public.can_access_board(a.board_id,'detail_read')
        and (a.purpose='inline_image' or (public.can_access_board(a.board_id,'attachment_view') and public.can_access_board(a.board_id,'attachment_download')))
    );
$$;

-- 3) 글 상세: 첨부 목록(본문 이미지 + 첨부파일)
create or replace function public.get_board_post(p_post_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  p public.board_posts;
  author_name text;
  author_department text;
  author_position text;
  author_job_title text;
  result jsonb;
begin
  select * into p from public.board_posts where id=p_post_id and status<>'deleted' and deleted_at is null;
  if p.id is null or not public.can_access_board(p.board_id,'detail_read') then raise exception 'post_access_denied' using errcode='42501'; end if;
  if p.status='draft' and p.author_user_id<>auth.uid() and not public.can_access_board(p.board_id,'other_post_update') then raise exception 'post_access_denied' using errcode='42501'; end if;
  insert into public.board_post_views(post_id,user_id,viewed_on) values(p.id,auth.uid(),current_date) on conflict do nothing;
  if found then update public.board_posts set view_count=view_count+1 where id=p.id; p.view_count:=p.view_count+1; end if;
  select
    case when p.is_anonymous then '익명' else profile.name end,
    case when p.is_anonymous then null else department.name end,
    case when p.is_anonymous then null else position_row.name end,
    case when p.is_anonymous then null else job_title.name end
  into author_name,author_department,author_position,author_job_title
  from public.profiles profile
  left join public.departments department on department.id=profile.department_id
  left join public.positions position_row on position_row.id=profile.position_id
  left join public.job_titles job_title on job_title.id=profile.job_title_id
  where profile.id=p.author_user_id;
  select jsonb_build_object(
    'post',jsonb_build_object(
      'id',p.id,'board_id',p.board_id,'category_id',p.category_id,'title',p.title,'content',p.content,
      'content_document',p.content_document,'cover_attachment_id',p.cover_attachment_id,'prefix',p.post_prefix,
      'is_anonymous',p.is_anonymous,'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,
      'view_count',p.view_count,'created_at',p.created_at,'edited_at',p.edited_at,'author_name',author_name,
      'author_department',author_department,'author_position',author_position,'author_job_title',author_job_title,
      'can_edit',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_update')) or public.can_access_board(p.board_id,'other_post_update'),
      'can_delete',(p.author_user_id=auth.uid() and public.can_access_board(p.board_id,'own_post_delete')) or public.can_access_board(p.board_id,'other_post_delete')
    ),
    'comments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'parent_comment_id',c.parent_comment_id,'content',case when c.deleted_at is null then c.content else '삭제된 댓글입니다.' end,
      'author_name',case when c.deleted_at is not null then '' when c.is_anonymous then '익명' else cp.name end,'created_at',c.created_at,
      'can_edit',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_update')) or public.can_access_board(c.board_id,'other_comment_update')),
      'can_delete',c.deleted_at is null and ((c.author_user_id=auth.uid() and public.can_access_board(c.board_id,'own_comment_delete')) or public.can_access_board(c.board_id,'other_comment_delete'))
    ) order by c.created_at) from public.board_comments c left join public.profiles cp on cp.id=c.author_user_id where c.post_id=p.id),'[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'original_name',a.original_name,'mime_type',a.mime_type,'file_size',a.file_size,'purpose',a.purpose,
      'alt_text',a.alt_text,'caption',a.caption,'alignment',a.alignment,'display_size',a.display_size,
      'display_width',a.display_width,'sort_order',a.sort_order,'image_width',a.image_width,'image_height',a.image_height
    ) order by coalesce(a.sort_order,2147483647),a.created_at) from public.board_attachments a
      where a.post_id=p.id and a.deleted_at is null and a.lifecycle_status='active'
        and (a.purpose='inline_image' or public.can_access_board(a.board_id,'attachment_view'))),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- 4) 게시판 목록의 썸네일(대표 이미지 · 본문 첫 이미지 · 주소 이미지)
create or replace function public.get_board_posts(
  p_slug text,
  p_search text default null,
  p_category uuid default null,
  p_page integer default 1,
  p_scope text default 'all'
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog'
as $function$
declare b public.boards; page_size integer; result jsonb; effective_search text; effective_scope text;
begin
  select * into b from public.boards where slug=p_slug;
  if b.id is null or not public.can_access_board(b.id,'list_read') then
    raise exception 'board_access_denied' using errcode='42501';
  end if;
  page_size:=least(greatest(coalesce((b.settings->>'page_size')::integer,20),5),100);
  effective_search:=case when coalesce((b.settings->>'search_enabled')::boolean,true) then nullif(btrim(p_search),'') else null end;
  effective_scope:=case when lower(coalesce(p_scope,'all')) in ('title','author') then lower(p_scope) else 'all' end;

  select jsonb_build_object(
    'items',coalesce(jsonb_agg(item order by is_pinned desc,discussion_activity desc nulls last,popularity desc nulls last,oldest_date asc nulls last,created_at desc),'[]'::jsonb),
    'page',greatest(p_page,1),
    'page_size',page_size,
    'total_count',(select count(*) from public.board_posts total
      left join public.profiles total_author on total_author.id=total.author_user_id
      where total.board_id=b.id and total.status='published' and total.deleted_at is null
        and (p_category is null or total.category_id=p_category)
        and (effective_search is null or case effective_scope
          when 'title' then total.title ilike '%'||effective_search||'%'
          when 'author' then (case when total.is_anonymous then '익명' else total_author.name end) ilike '%'||effective_search||'%'
          else total.title ilike '%'||effective_search||'%' or total.content ilike '%'||effective_search||'%'
        end))
  ) into result
  from (
    select
      jsonb_build_object(
        'id',p.id,'title',p.title,'prefix',p.post_prefix,'category',c.name,
        'is_notice',p.is_notice,'is_important',p.is_important,'is_pinned',p.is_pinned,
        'view_count',p.view_count,'comment_count',p.comment_count,'attachment_count',p.attachment_count,
        'created_at',p.created_at,'last_activity_at',coalesce(last_comment.created_at,p.created_at),
        'excerpt',left(regexp_replace(coalesce(p.content,''),'[[:space:]]+',' ','g'),180),
        'author_name',case when p.is_anonymous then '익명' else pr.name end,
        'author_department',case when p.is_anonymous then null else department.name end,
        'author_position',case when p.is_anonymous then null else position_row.name end,
        'author_job_title',case when p.is_anonymous then null else job_title.name end,
        'cover_attachment_id',p.cover_attachment_id,
        'inline_attachment_id',jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),'$.**?(@.type == "inlineImage").attrs.attachmentId') #>> '{}',
        'external_image_src',jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),'$.**?(@.type == "externalImage").attrs.src') #>> '{}'
      ) item,
      p.is_pinned,
      case when b.board_type='discussion' then coalesce(last_comment.created_at,p.created_at) end discussion_activity,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='popular' then p.view_count+(p.comment_count*3) end popularity,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='oldest' then p.created_at end oldest_date,
      p.created_at
    from public.board_posts p
    left join public.profiles pr on pr.id=p.author_user_id
    left join public.departments department on department.id=pr.department_id
    left join public.positions position_row on position_row.id=pr.position_id
    left join public.job_titles job_title on job_title.id=pr.job_title_id
    left join public.board_categories c on c.id=p.category_id
    left join lateral (
      select max(comment.created_at) created_at
      from public.board_comments comment
      where comment.post_id=p.id and comment.deleted_at is null
    ) last_comment on true
    where p.board_id=b.id and p.status='published' and p.deleted_at is null
      and (p_category is null or p.category_id=p_category)
      and (effective_search is null or case effective_scope
        when 'title' then p.title ilike '%'||effective_search||'%'
        when 'author' then (case when p.is_anonymous then '익명' else pr.name end) ilike '%'||effective_search||'%'
        else p.title ilike '%'||effective_search||'%' or p.content ilike '%'||effective_search||'%'
      end)
    order by
      p.is_pinned desc,
      case when b.board_type='discussion' then coalesce(last_comment.created_at,p.created_at) end desc nulls last,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='popular' then p.view_count+(p.comment_count*3) end desc nulls last,
      case when b.board_type<>'discussion' and coalesce(b.settings->>'default_sort','latest')='oldest' then p.created_at end asc nulls last,
      p.created_at desc
    limit page_size offset (greatest(p_page,1)-1)*page_size
  ) rows;
  return result;
end;
$function$;

revoke all on function public.get_board_posts(text,text,uuid,integer,text) from public, anon;
grant execute on function public.get_board_posts(text,text,uuid,integer,text) to authenticated, service_role;

-- 5) 홈 화면 앨범 띠 썸네일
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
          'inline_attachment_id', jsonb_path_query_first(coalesce(p.content_document,'{}'::jsonb),
            '$.**?(@.type == "inlineImage").attrs.attachmentId') #>> '{}',
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

commit;
