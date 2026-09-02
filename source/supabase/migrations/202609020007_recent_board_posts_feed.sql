-- 대시보드의 "최신 게시글" 줄.
--
-- 게시판마다 따로 불러 화면에서 합치면, 볼 수 있는 게시판이 늘어날수록 요청이
-- 그만큼 늘고 정렬도 클라이언트가 떠안는다. 한 번에 읽고 정렬해서 내려준다.
--
-- 권한은 게시판 목록과 같은 기준(list_read)을 쓴다. 읽을 수 없는 게시판의 글이
-- 제목만이라도 새어 나가면 안 된다.
create or replace function public.get_my_recent_board_posts(p_limit integer default 5)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog'
as $function$
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'board_name', b.name,
      'board_slug', b.slug,
      'author_name', case when p.is_anonymous then '익명' else pr.name end,
      'comment_count', p.comment_count,
      'created_at', p.created_at
    ) item, p.created_at
    from public.board_posts p
    join public.boards b on b.id = p.board_id
    left join public.profiles pr on pr.id = p.author_user_id
    where p.status = 'published'
      and p.deleted_at is null
      and b.is_active
      and b.archived_at is null
      and public.can_access_board(b.id, 'list_read')
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ) rows;
$function$;

revoke all on function public.get_my_recent_board_posts(integer) from public, anon;
grant execute on function public.get_my_recent_board_posts(integer) to authenticated, service_role;
