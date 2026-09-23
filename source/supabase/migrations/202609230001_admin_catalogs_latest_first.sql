-- 관리자 화면 카탈로그 목록을 최신순으로 정렬한다.
-- 기존에는 sort_order 가 1순위여서 오래된 글이 최신 글보다 위에 떴다.
-- 관리자가 최근 작성/발행한 글을 바로 찾을 수 있도록 published_at / starts_at 최신순으로 변경한다.

create or replace function public.get_site_article_admin_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'articles', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.archived_at nulls first, a.published_at desc nulls last, a.created_at desc)
      from public.site_articles a
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_popup_admin_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.archived_at nulls first, d.starts_at desc nulls last, d.created_at desc)
      from public.popup_documents d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_site_article_admin_catalog() from public, anon, authenticated;
grant execute on function public.get_site_article_admin_catalog() to authenticated;

revoke all on function public.get_popup_admin_catalog() from public, anon, authenticated;
grant execute on function public.get_popup_admin_catalog() to authenticated;
