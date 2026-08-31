begin;

-- 썸네일을 따로 지정하지 않았으면 본문 맨 앞 이미지를 목록 카드 썸네일로 쓴다.
-- 저장 시점이 아니라 조회 시점에 뽑으므로 본문을 고치면 썸네일도 따라 바뀐다.
-- 안전하지 않은 주소(javascript:, data: 등)는 쓰지 않는다.
create or replace function public.first_article_image(p_html text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when found ~* '^(https://|/)' then found
    else null
  end
  from (select (regexp_match(coalesce(p_html, ''), '<img[^>]+src="([^"]+)"', 'i'))[1] as found) s;
$$;

revoke all on function public.first_article_image(text) from public, anon, authenticated;

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
  order by a.sort_order, a.published_at desc, a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

commit;
