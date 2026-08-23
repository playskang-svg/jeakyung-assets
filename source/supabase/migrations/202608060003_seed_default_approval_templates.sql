create or replace function public.__seed_default_approval_templates()
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cat_common uuid;
begin
  insert into public.approval_categories (name, code, description, sort_order, is_active)
  values ('공통기안', 'CAT_COMMON', '일반 업무 기안 및 공통 품의서', 10, true)
  returning id into cat_common;
  return 'ok';
exception when others then
  return SQLERRM;
end; $$;

select public.__seed_default_approval_templates();
drop function public.__seed_default_approval_templates();
