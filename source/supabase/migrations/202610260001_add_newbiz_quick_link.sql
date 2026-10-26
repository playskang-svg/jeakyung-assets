-- 대시보드 '페이지' 빠른 실행 줄에 '공공사업권 DB' 버튼 추가
-- 사내메일(10) 바로 다음인 sort_order 15로 배치

insert into public.quick_links (label, url, variant, size, open_in, visibility, sort_order)
select '공공사업권 DB', 'https://jeakyung.com/groupware/newbiz01/', 'primary', 'md', 'tab', 'all', 15
where not exists (select 1 from public.quick_links where url like '%/groupware/newbiz01/%');
