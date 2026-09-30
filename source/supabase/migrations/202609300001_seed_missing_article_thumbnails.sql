begin;

-- 나노바나나 엔진으로 생성된 소식/정보 글 9건의 WebP 썸네일 경로를 일괄 적용한다.
update public.site_articles
set thumbnail_url = '/assets/articles/logistics-workforce.webp'
where id = '676dacaa-86ac-4737-93ab-8a0388c542c3';

update public.site_articles
set thumbnail_url = '/assets/articles/esg-logistics.webp'
where id = '7d946bbb-e6d1-4172-bf2e-bf86b8cffb9c';

update public.site_articles
set thumbnail_url = '/assets/articles/3pl-selection-criteria.webp'
where id = 'a99c27d3-6109-4e83-9598-7a8706b116db';

update public.site_articles
set thumbnail_url = '/assets/articles/digital-logistics-wms-tms.webp'
where id = 'a6ed4a2a-8e88-49a6-935e-7f516141e58f';

update public.site_articles
set thumbnail_url = '/assets/articles/warehouse-safety-management.webp'
where id = '53098f28-f4e7-49d3-9fc9-f866c2ba5a61';

update public.site_articles
set thumbnail_url = '/assets/articles/cost-reduction-guide.webp'
where id = 'd206417e-2592-4035-b33b-1662bf3d933b';

update public.site_articles
set thumbnail_url = '/assets/articles/regional-logistics-hub.webp'
where id = 'f25b65a9-89f1-4630-b94f-81d8108f394d';

update public.site_articles
set thumbnail_url = '/assets/articles/logistics-market-outlook-2026.webp'
where id = '179cd6a3-78dc-49ae-8bff-5a27fc16d443';

update public.site_articles
set thumbnail_url = '/assets/articles/fulfillment-automation-robot.webp'
where id = 'eda292ca-c47b-4a72-a6de-6662077875c1';

commit;
