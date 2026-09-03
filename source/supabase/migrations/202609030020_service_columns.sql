-- 서비스 카드마다 그 서비스의 칼럼을 붙인다.
--
-- 소식/정보와 같은 표(site_articles)를 쓰되 service_key 로 가른다.
--   service_key 가 비면  → 소식/정보
--   값이 있으면          → 그 서비스 카드의 칼럼
-- 표를 따로 만들지 않은 이유는, 글의 생김새(제목·요약·썸네일·본문)가 같고
-- 관리 화면과 본문 조회 함수를 그대로 쓸 수 있기 때문이다.
alter table public.site_articles add column if not exists service_key text;

alter table public.site_articles drop constraint if exists site_articles_service_key_format;
alter table public.site_articles add constraint site_articles_service_key_format
  check (service_key is null or service_key ~ '^[a-z0-9_-]{1,40}$');

create index if not exists site_articles_service_key_idx
  on public.site_articles (service_key, published_at desc)
  where service_key is not null and is_active and archived_at is null;

-- 소식/정보 목록에서 서비스 칼럼을 뺀다. 안 그러면 같은 글이 두 곳에 나온다.
create or replace function public.get_public_site_articles(p_limit integer default 12)
returns table(id uuid, title text, category text, summary text, author text, thumbnail_url text, published_at timestamptz)
language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select a.id, a.title, a.category, a.summary, a.author,
    coalesce(a.thumbnail_url, public.first_article_image(a.content_html)) as thumbnail_url,
    a.published_at
  from public.site_articles a
  where a.is_active and a.archived_at is null and a.published_at <= now()
    and a.service_key is null
  order by a.published_at desc, a.sort_order, a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$function$;

create or replace function public.get_public_service_articles(p_service_key text, p_limit integer default 12)
returns table(id uuid, title text, category text, summary text, author text, thumbnail_url text, published_at timestamptz)
language sql stable security definer set search_path to 'pg_catalog'
as $function$
  select a.id, a.title, a.category, a.summary, a.author,
    coalesce(a.thumbnail_url, public.first_article_image(a.content_html)) as thumbnail_url,
    a.published_at
  from public.site_articles a
  where a.is_active and a.archived_at is null and a.published_at <= now()
    and a.service_key = nullif(btrim(coalesce(p_service_key, '')), '')
  order by a.published_at desc, a.sort_order, a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$function$;

revoke all on function public.get_public_service_articles(text, integer) from public;
grant execute on function public.get_public_service_articles(text, integer) to anon, authenticated;

-- 관리자 저장 함수가 service_key 를 받게 한다. 함수가 크고 여러 곳을 거쳐
-- 왔으므로 통째로 옮겨 적지 않고 세 자리만 바꿔 넣는다.
do $do$
declare
  src text;
  n1 text := $a$  article_published_at timestamptz;$a$;
  r1 text := $a$  article_published_at timestamptz;
  article_service_key text := nullif(btrim(coalesce(p_article ->> 'service_key', '')), '');$a$;
  n2 text := $a$      title, category, summary, author, thumbnail_url, content_mode, content_html,$a$;
  r2 text := $a$      title, category, summary, author, thumbnail_url, content_mode, content_html, service_key,$a$;
  n3 text := $a$      article_mode, article_html, article_published_at,$a$;
  r3 text := $a$      article_mode, article_html, article_service_key, article_published_at,$a$;
begin
  src := pg_get_functiondef('public.manage_site_article'::regproc);
  if position('article_service_key' in src) > 0 then return; end if;
  if (length(src)-length(replace(src,n1,'')))/length(n1) <> 1 then raise exception '변수 자리를 찾지 못했다'; end if;
  if (length(src)-length(replace(src,n2,'')))/length(n2) <> 1 then raise exception '열 목록을 찾지 못했다'; end if;
  if (length(src)-length(replace(src,n3,'')))/length(n3) <> 1 then raise exception '값 목록을 찾지 못했다'; end if;
  execute replace(replace(replace(src,n1,r1),n2,r2),n3,r3);
end
$do$;
