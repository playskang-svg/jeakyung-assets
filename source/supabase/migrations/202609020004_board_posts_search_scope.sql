-- 게시판 목록 검색에 범위(전체/제목/작성자)를 더한다.
-- 화면의 검색창 옆 드롭다운이 실제로 동작하게 하기 위한 것으로, 예전에는
-- 제목·본문만 훑었다. 작성자 검색은 화면에 보이는 이름 기준이라 익명 글은
-- '익명' 으로 찾힌다(실명으로는 찾히지 않는다 — 익명성을 지키기 위해서다).
--
-- 인자가 하나 늘어 시그니처가 달라지므로 예전 4-인자 함수는 지운다. 둘을
-- 함께 두면 PostgREST 가 이름 기반 호출에서 어느 쪽인지 못 고른다.
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
  -- 모르는 값이 오면 전체 검색으로 되돌린다.
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
        'cover_attachment_id',case when public.can_access_board(p.board_id,'attachment_view') then p.cover_attachment_id else null end
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

drop function if exists public.get_board_posts(text,text,uuid,integer);
