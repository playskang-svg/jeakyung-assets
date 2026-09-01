-- 글에 작성자를 적을 수 있게 한다. 계정과 무관한 표시용 이름이라 자유 입력이다
-- (부서 이름이나 "재경닷컴 편집팀" 처럼 쓸 수 있어야 한다).
alter table public.site_articles
  add column if not exists author text;

-- 반환 열이 늘어나므로 기존 함수를 먼저 지운다.
drop function if exists public.get_public_site_articles(integer);
drop function if exists public.get_public_site_article(uuid);

create function public.get_public_site_articles(p_limit integer default 12)
returns table (
  id uuid, title text, category text, summary text, author text,
  thumbnail_url text, published_at timestamptz
)
language sql stable security definer set search_path = pg_catalog as $$
  select a.id, a.title, a.category, a.summary, a.author,
    coalesce(a.thumbnail_url, public.first_article_image(a.content_html)) as thumbnail_url,
    a.published_at
  from public.site_articles a
  where a.is_active and a.archived_at is null and a.published_at <= now()
  order by a.published_at desc, a.sort_order, a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

create function public.get_public_site_article(p_id uuid)
returns table (
  id uuid, title text, category text, summary text, author text,
  thumbnail_url text, content_html text, published_at timestamptz
)
language sql stable security definer set search_path = pg_catalog as $$
  select a.id, a.title, a.category, a.summary, a.author,
    a.thumbnail_url, a.content_html, a.published_at
  from public.site_articles a
  where a.id = p_id and a.is_active and a.archived_at is null and a.published_at <= now();
$$;

grant execute on function public.get_public_site_articles(integer) to anon, authenticated;
grant execute on function public.get_public_site_article(uuid) to anon, authenticated;
