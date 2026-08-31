-- 소식/정보 목록은 등록 순서가 아니라 작성일(published_at) 기준으로 최신 글이
-- 앞에 오게 한다. sort_order 는 같은 날짜 글끼리의 순서만 정한다.
create or replace function public.get_public_site_articles(p_limit integer default 12)
returns table (
  id uuid,
  title text,
  category text,
  summary text,
  thumbnail_url text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select a.id, a.title, a.category, a.summary,
    coalesce(a.thumbnail_url, public.first_article_image(a.content_html)) as thumbnail_url,
    a.published_at
  from public.site_articles a
  where a.is_active
    and a.archived_at is null
    and a.published_at <= now()
  order by a.published_at desc, a.sort_order, a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;
