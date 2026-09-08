-- 지입업무 탭 페이지 7개 회사 탭, 게시판 카테고리 5종, 연도별 바로가기 버튼 박스 구성
begin;

-- 1. 지입업무 소속 7개 게시판 등록/보정
-- (유) 재경로지스 메인 (기존 consign-vehicle 재활용 및 보정)
update public.boards
set name = '(유) 재경로지스 메인',
    slug = 'consign-jaekyung',
    description = '(유) 재경로지스 지입차량 및 계약서류 관리 게시판입니다.',
    is_active = true,
    settings = coalesce(settings, '{}'::jsonb) || '{"show_in_sidebar": false}'::jsonb
where slug in ('consign-vehicle', 'consign-jaekyung');

insert into public.boards (group_id, name, slug, description, board_type, sort_order, is_active, settings)
select '679d0508-671c-4157-9727-1bdf66216b27'::uuid, '(유) 재경로지스 메인', 'consign-jaekyung', '(유) 재경로지스 지입차량 및 계약서류 관리 게시판입니다.', 'free', 10, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb
where not exists (select 1 from public.boards where slug = 'consign-jaekyung');

-- 나머지 6개 게시판 등록
insert into public.boards (group_id, name, slug, description, board_type, sort_order, is_active, settings)
values
  ('679d0508-671c-4157-9727-1bdf66216b27'::uuid, '(주)에스에이치L', 'consign-shl', '(주)에스에이치L 지입차량 및 계약서류 관리 게시판입니다.', 'free', 20, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb),
  ('679d0508-671c-4157-9727-1bdf66216b27'::uuid, '(유)재경상운', 'consign-jaekyungsangwoon', '(유)재경상운 지입차량 및 계약서류 관리 게시판입니다.', 'free', 30, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb),
  ('679d0508-671c-4157-9727-1bdf66216b27'::uuid, '(유)삼삼물류', 'consign-samsam', '(유)삼삼물류 지입차량 및 계약서류 관리 게시판입니다.', 'free', 40, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb),
  ('679d0508-671c-4157-9727-1bdf66216b27'::uuid, '(유)대경운수', 'consign-daekyung', '(유)대경운수 지입차량 및 계약서류 관리 게시판입니다.', 'free', 50, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb),
  ('679d0508-671c-4157-9727-1bdf66216b27'::uuid, '(주)왕대박물류', 'consign-wangdaebak', '(주)왕대박물류 지입차량 및 계약서류 관리 게시판입니다.', 'free', 60, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb),
  ('679d0508-671c-4157-9727-1bdf66216b27'::uuid, '지입업무서식', 'consign-forms', '지입업무 공통 서식 및 양식 자료실입니다.', 'free', 70, true, '{"show_in_sidebar": false, "page_size": 20}'::jsonb)
on conflict (slug) do update
set name = excluded.name, description = excluded.description, is_active = true;

-- 2. 7개 게시판 권한 규칙 등록 (전체 열람/작성 허용)
insert into public.board_permission_rules (board_id, action, target_type, effect)
select b.id, a.action, 'all', 'allow'
from public.boards b
cross join (values
  ('sidebar_view'),('list_read'),('detail_read'),
  ('post_create'),('own_post_update'),('own_post_delete'),
  ('comment_create'),('own_comment_update'),('own_comment_delete'),
  ('attachment_view'),('attachment_download'),('attachment_upload')
) as a(action)
where b.slug in ('consign-jaekyung', 'consign-shl', 'consign-jaekyungsangwoon', 'consign-samsam', 'consign-daekyung', 'consign-wangdaebak', 'consign-forms')
  and not exists (
    select 1 from public.board_permission_rules r
    where r.board_id = b.id and r.action = a.action
  );

-- 3. 기존 불필요 카테고리(광주본사사업부 등) 비활성화 또는 삭제하고, 3번째 이미지 카테고리 5종 일괄 등록
delete from public.board_categories
where board_id in (select id from public.boards where slug in ('consign-jaekyung', 'consign-shl', 'consign-jaekyungsangwoon', 'consign-samsam', 'consign-daekyung', 'consign-wangdaebak', 'consign-forms'))
  and code in ('gwangju-hq', 'jeolla', 'seoul-gyeonggi', 'gyeongsang', 'consignment');

insert into public.board_categories (board_id, name, code, sort_order, is_active)
select b.id, v.name, v.code, v.sort_order, true
from public.boards b
cross join (values
  ('위수탁계약서', 'contract', 10),
  ('차량등록증', 'vehicle-reg', 20),
  ('사업자등록증', 'biz-reg', 30),
  ('신분증/자격증', 'id-license', 40),
  ('수입/지출현황', 'income-expense', 50)
) as v(name, code, sort_order)
where b.slug in ('consign-jaekyung', 'consign-shl', 'consign-jaekyungsangwoon', 'consign-samsam', 'consign-daekyung', 'consign-wangdaebak', 'consign-forms')
  and not exists (
    select 1 from public.board_categories c
    where c.board_id = b.id and c.code = v.code
  );

-- 4. 버튼 박스 등록
-- (유)재경로지스 바로가기 (실제 링크 3개 연결)
insert into public.button_boxes (title, style, is_active)
values ('(유)재경로지스 바로가기', 'cards', true)
on conflict do nothing;

do $$
declare
  v_box_id uuid;
begin
  select id into v_box_id from public.button_boxes where title = '(유)재경로지스 바로가기' limit 1;
  if v_box_id is not null then
    delete from public.button_box_items where box_id = v_box_id;
    insert into public.button_box_items (box_id, label, description, link_type, url, sort_order)
    values
      (v_box_id, '2024년', '2024년 구글 스프레드시트 바로가기', 'external', 'https://docs.google.com/spreadsheets/d/1a7Xjw3pXXDyNDMnpWrsC_KLiKcWVwYvV/edit?usp=drive_link&ouid=100985608709354268665&rtpof=true&sd=true', 10),
      (v_box_id, '2025년', '2025년 구글 스프레드시트 바로가기', 'external', 'https://docs.google.com/spreadsheets/d/1xkyQD-2-iLOInwfqmomzO80J8OXLTunv/edit?usp=drive_link&ouid=100985608709354268665&rtpof=true&sd=true', 20),
      (v_box_id, '2026년', '2026년 구글 스프레드시트 바로가기', 'external', 'https://docs.google.com/spreadsheets/d/1scCKle0gy_Mu-rFVkWEGyEkVLb5HkAnj/edit?usp=drive_link&ouid=100985608709354268665&rtpof=true&sd=true', 30);
  end if;
end $$;

-- 나머지 6개 버튼 박스 생성 (관리자페이지에서 수정 가능하도록 기본 버튼 세팅)
do $$
declare
  box_names text[] := array['(주)에스에이치L 바로가기', '(유)재경상운 바로가기', '(유)삼삼물류 바로가기', '(유)대경운수 바로가기', '(주)왕대박물류 바로가기', '지입업무서식 바로가기'];
  b_name text;
  v_id uuid;
begin
  foreach b_name in array box_names
  loop
    insert into public.button_boxes (title, style, is_active)
    values (b_name, 'cards', true)
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.button_boxes where title = b_name limit 1;
    end if;

    if v_id is not null and not exists (select 1 from public.button_box_items where box_id = v_id) then
      insert into public.button_box_items (box_id, label, description, link_type, url, sort_order)
      values
        (v_id, '2024년', '2024년 바로가기', 'external', '#', 10),
        (v_id, '2025년', '2025년 바로가기', 'external', '#', 20),
        (v_id, '2026년', '2026년 바로가기', 'external', '#', 30);
    end if;
  end loop;
end $$;

-- 5. 지입업무(consignment) 페이지 항목을 7개 탭으로 재구성
do $$
declare
  v_page_id uuid;
  b_jaekyung uuid; b_shl uuid; b_sangwoon uuid; b_samsam uuid; b_daekyung uuid; b_wangdaebak uuid; b_forms uuid;
  box_jaekyung uuid; box_shl uuid; box_sangwoon uuid; box_samsam uuid; box_daekyung uuid; box_wangdaebak uuid; box_forms uuid;
begin
  select id into v_page_id from public.link_pages where slug = 'consignment' limit 1;
  if v_page_id is null then
    insert into public.link_pages (title, slug, description, is_active, sort_order)
    values ('지입업무', 'consignment', '지입 업무 차량 및 계약 관리 페이지입니다.', true, 10)
    returning id into v_page_id;
  end if;

  select id into b_jaekyung from public.boards where slug = 'consign-jaekyung' limit 1;
  select id into b_shl from public.boards where slug = 'consign-shl' limit 1;
  select id into b_sangwoon from public.boards where slug = 'consign-jaekyungsangwoon' limit 1;
  select id into b_samsam from public.boards where slug = 'consign-samsam' limit 1;
  select id into b_daekyung from public.boards where slug = 'consign-daekyung' limit 1;
  select id into b_wangdaebak from public.boards where slug = 'consign-wangdaebak' limit 1;
  select id into b_forms from public.boards where slug = 'consign-forms' limit 1;

  select id into box_jaekyung from public.button_boxes where title = '(유)재경로지스 바로가기' limit 1;
  select id into box_shl from public.button_boxes where title = '(주)에스에이치L 바로가기' limit 1;
  select id into box_sangwoon from public.button_boxes where title = '(유)재경상운 바로가기' limit 1;
  select id into box_samsam from public.button_boxes where title = '(유)삼삼물류 바로가기' limit 1;
  select id into box_daekyung from public.button_boxes where title = '(유)대경운수 바로가기' limit 1;
  select id into box_wangdaebak from public.button_boxes where title = '(주)왕대박물류 바로가기' limit 1;
  select id into box_forms from public.button_boxes where title = '지입업무서식 바로가기' limit 1;

  delete from public.link_page_items where page_id = v_page_id;

  insert into public.link_page_items (page_id, label, item_type, board_id, button_box_id, sort_order)
  values
    (v_page_id, '(유)재경로지스', 'board', b_jaekyung, box_jaekyung, 0),
    (v_page_id, '(주)에스에이치L', 'board', b_shl, box_shl, 1),
    (v_page_id, '(유)재경상운', 'board', b_sangwoon, box_sangwoon, 2),
    (v_page_id, '(유)삼삼물류', 'board', b_samsam, box_samsam, 3),
    (v_page_id, '(유)대경운수', 'board', b_daekyung, box_daekyung, 4),
    (v_page_id, '(주)왕대박물류', 'board', b_wangdaebak, box_wangdaebak, 5),
    (v_page_id, '지입업무서식', 'board', b_forms, box_forms, 6);
end $$;

commit;
