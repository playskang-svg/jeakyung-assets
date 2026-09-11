-- 홈 '최신 게시글'에서 뺄 게시판.
--
-- 대표님 전용 게시판은 볼 수 있는 세 사람의 홈에서도 최신 게시글 줄에 올리지
-- 않는다. 홈 화면은 옆 사람이 함께 보는 일이 잦다.
--
-- 게시판 설정(settings)의 show_in_recent 로 정한다. show_in_sidebar(대시보드 숨김)와
-- 나란히 두어 관리자 화면에서 켜고 끄며, 값이 없으면 지금처럼 올린다.
begin;

create or replace function public.get_my_recent_board_posts(p_limit integer default 5)
returns jsonb language sql stable security definer set search_path to 'pg_catalog'
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
      and coalesce((b.settings->>'show_in_recent')::boolean, true)
      and public.can_access_board(b.id, 'list_read')
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ) rows;
$function$;

update public.boards
set settings = coalesce(settings, '{}'::jsonb) || '{"show_in_recent": false}'::jsonb
where slug = 'ceo-private-board';

commit;
