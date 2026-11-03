-- 2026-11-03
-- (1) 일반업무의 '전라남북사업부'를 염당성·신한나·강석기 세 사람만 볼 수 있게 한다.
-- (2) 대시보드 빠른 실행 줄의 '지입업무' 버튼을 지운다.
--
-- ── 왜 분류(카테고리) 권한이 아니라 별도 게시판인가 ─────────────────────────
-- 게시판 권한(board_permission_rules)은 게시판 단위다. 분류 단위로 막으려면
-- 글 목록·상세·전체 검색·최근 글·앨범·첨부 경로·저장소 정책 등 글을 읽는 RPC를
-- 전부 고쳐야 하고, 하나라도 빠지면 그 길로 글이 샌다(전체 검색 RPC
-- search_board_posts 는 저장소에 정의조차 없다). 그래서 전라남북사업부를 따로
-- 게시판(general-work-jeolla)으로 떼어 내 세 사람에게만 권한을 주고, 일반업무
-- 화면에서는 같은 자리의 탭으로 그 게시판에 이어 준다(get_board_linked_tabs).
-- 그러면 위의 모든 읽기 경로가 이미 검증된 게시판 권한 검사(can_access_board)를
-- 그대로 탄다.
--
-- ── 시스템 관리자(super_admin)도 막는다 ───────────────────────────────────
-- evaluate_board_access 는 super_admin 이면 모든 게시판을 통과시킨다. "세 사람
-- 외에는 아무도" 라는 요구를 지키려고 settings.strict_access = true 인 게시판에서만
-- 이 우회를 끈다. 다른 게시판의 동작은 바뀌지 않는다. 게시판 관리 화면(관리자
-- RPC)은 is_membership_admin 으로 따로 검사하므로 권한 규칙 편집은 여전히 된다.

begin;

-- 0) 세 사람의 계정을 이름으로 찾는다. 하나라도 없거나 동명이인이 있으면 멈춘다
--    (조용히 두 사람에게만 권한이 가는 일을 막기 위해).
do $$
declare
  wanted text[] := array['염당성','신한나','강석기'];
  person text;
  hit integer;
begin
  foreach person in array wanted loop
    select count(*) into hit from public.profiles where btrim(name) = person;
    if hit <> 1 then
      raise exception 'jeolla_access_user_lookup_failed: % (찾은 계정 % 개)', person, hit;
    end if;
  end loop;
end $$;

-- 1) super_admin 우회를 strict_access 게시판에서만 끈다.
--    본문은 202607310006 의 정의 그대로이고, 둘째 줄의 조건만 더했다.
create or replace function public.evaluate_board_access(p_board_id uuid, p_action text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(
    select 1 from public.profiles
    where id=p_user_id and membership_status='approved' and employment_status <> 'resigned'
  ) and (
    (
      public.user_has_active_role(p_user_id, 'super_admin')
      and not exists(select 1 from public.boards sb where sb.id=p_board_id and coalesce((sb.settings->>'strict_access')::boolean,false))
    ) or (
      exists(select 1 from public.boards where id=p_board_id and is_active and archived_at is null)
      and exists(select 1 from public.board_permission_rules r where r.board_id=p_board_id and r.action=p_action and r.effect='allow' and public.board_target_matches(p_board_id,r.target_type,r.target_id,p_user_id))
      and not exists(select 1 from public.board_permission_rules r where r.board_id=p_board_id and r.action=p_action and r.effect='deny' and public.board_target_matches(p_board_id,r.target_type,r.target_id,p_user_id))
    )
  );
$$;

-- 2) 전라남북사업부 전용 게시판을 만들고, 기존 글을 옮기고, 일반업무의 분류는 끈다.
do $$
declare
  parent public.boards;
  child_id uuid;
  jeolla_category uuid;
  person_id uuid;
  action_name text;
begin
  select * into parent from public.boards where slug = 'general-work';
  if parent.id is null then
    raise exception 'general_work_board_not_found';
  end if;

  select id into child_id from public.boards where slug = 'general-work-jeolla';
  if child_id is null then
    insert into public.boards(group_id, name, slug, description, board_type, settings, sort_order, is_active, created_by)
    values (
      parent.group_id,
      '전라남북사업부',
      'general-work-jeolla',
      '일반업무 · 전라남북사업부 (지정된 담당자만 접근)',
      parent.board_type,
      coalesce(parent.settings, '{}'::jsonb) || jsonb_build_object(
        'show_in_sidebar', false,          -- 따로 카드로 띄우지 않고 일반업무 탭으로만 들어간다
        'strict_access', true,             -- super_admin 우회 끔
        'parent_board_slug', 'general-work',
        'parent_tab_after_code', 'gwangju-hq' -- 일반업무 탭 줄에서 광주본사사업부 다음 자리
      ),
      coalesce(parent.sort_order, 0) + 1,
      true,
      null
    )
    returning id into child_id;
  else
    update public.boards
    set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
          'show_in_sidebar', false, 'strict_access', true,
          'parent_board_slug', 'general-work', 'parent_tab_after_code', 'gwangju-hq'),
        is_active = true, archived_at = null
    where id = child_id;
  end if;

  -- 권한: 세 사람에게만, 일반 직원 수준(읽기·쓰기·댓글·첨부, 자기 글/댓글 수정·삭제).
  -- 'all' / 역할 / 부서 대상 규칙은 하나도 두지 않는다.
  delete from public.board_permission_rules where board_id = child_id;
  for person_id in
    select id from public.profiles where btrim(name) in ('염당성','신한나','강석기')
  loop
    foreach action_name in array array[
      'sidebar_view','list_read','detail_read','post_create',
      'own_post_update','own_post_delete',
      'comment_create','own_comment_update','own_comment_delete',
      'attachment_view','attachment_download','attachment_upload'
    ] loop
      insert into public.board_permission_rules(board_id, action, target_type, target_id, effect)
      values (child_id, action_name, 'user', person_id::text, 'allow');
    end loop;
  end loop;

  -- 일반업무에 이미 '전라남북사업부'로 올라간 글을 새 게시판으로 옮긴다.
  -- 댓글·반응·첨부도 board_id 를 같이 바꿔야 권한 검사가 새 게시판 기준으로 돈다.
  -- (첨부의 저장소 경로 앞부분은 옛 게시판 id 로 남지만, 읽기 권한은 경로가 아니라
  --  board_attachments.board_id 로 검사하므로 문제없다.)
  select id into jeolla_category
  from public.board_categories
  where board_id = parent.id and code = 'jeolla';

  if jeolla_category is not null then
    update public.board_comments set board_id = child_id
    where post_id in (select id from public.board_posts where board_id = parent.id and category_id = jeolla_category);
    update public.board_reactions set board_id = child_id
    where post_id in (select id from public.board_posts where board_id = parent.id and category_id = jeolla_category);
    update public.board_attachments set board_id = child_id
    where post_id in (select id from public.board_posts where board_id = parent.id and category_id = jeolla_category);
    update public.board_posts set board_id = child_id, category_id = null
    where board_id = parent.id and category_id = jeolla_category;

    -- 분류 탭을 끈다. 더는 이 분류로 글을 쓸 수 없다(save_board_post 가 is_active 를 검사).
    update public.board_categories set is_active = false where id = jeolla_category;
  end if;
end $$;

-- 3) 상위 게시판 화면에 붙일 하위 게시판 탭. 볼 권한이 있는 것만 내려준다.
create or replace function public.get_board_linked_tabs(p_slug text)
returns jsonb language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', b.name,
      'slug', b.slug,
      'after_code', b.settings->>'parent_tab_after_code'
    ) order by b.sort_order, b.name), '[]'::jsonb)
  from public.boards b
  where b.settings->>'parent_board_slug' = p_slug
    and b.is_active and b.archived_at is null
    and public.can_access_board(b.id, 'list_read');
$$;

revoke all on function public.get_board_linked_tabs(text) from public, anon;
grant execute on function public.get_board_linked_tabs(text) to authenticated;

-- 4) 대시보드 빠른 실행 '지입업무' 버튼 삭제.
delete from public.quick_links
where label = '지입업무' or url like '%jeakyung.quv.kr/41%';

commit;
