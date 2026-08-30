begin;

-- 공개 사이트 "정보 및 동향" 문서.
-- 메인 히어로 바로 아래에 썸네일 + 요약 카드로 노출되고, 카드를 누르면 본문이
-- 팝업으로 열린다. 방문자는 로그인 없이 읽기만 하며 댓글·작성 기능은 없다.
-- 작성/수정은 그룹웨어 관리자만 할 수 있고, 팝업 문서와 같은 방식으로
-- security definer 함수로만 접근한다.

create table public.site_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  category text check (category is null or char_length(category) between 1 and 40),
  summary text check (summary is null or char_length(summary) <= 500),
  thumbnail_url text check (thumbnail_url is null or char_length(thumbnail_url) <= 1000),
  content_mode text not null default 'editor' check (content_mode in ('editor','html')),
  content_html text not null check (char_length(content_html) between 1 and 200000),
  published_at timestamptz not null default now(),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index site_articles_delivery_idx
  on public.site_articles (is_active, published_at desc, sort_order)
  where archived_at is null;

create trigger site_articles_set_updated_at
before update on public.site_articles
for each row execute function public.set_updated_at();

alter table public.site_articles enable row level security;

-- 목록: 본문(content_html)은 빼고 카드에 필요한 값만 준다. 본문은 카드를 눌렀을
-- 때 아래 상세 함수로 따로 가져온다.
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
  select a.id, a.title, a.category, a.summary, a.thumbnail_url, a.published_at
  from public.site_articles a
  where a.is_active
    and a.archived_at is null
    and a.published_at <= now()
  order by a.sort_order, a.published_at desc, a.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

create or replace function public.get_public_site_article(p_id uuid)
returns table (
  id uuid,
  title text,
  category text,
  summary text,
  thumbnail_url text,
  content_html text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select a.id, a.title, a.category, a.summary, a.thumbnail_url, a.content_html, a.published_at
  from public.site_articles a
  where a.id = p_id
    and a.is_active
    and a.archived_at is null
    and a.published_at <= now();
$$;

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
      select jsonb_agg(to_jsonb(a) order by a.archived_at nulls first, a.sort_order, a.published_at desc)
      from public.site_articles a
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.manage_site_article(p_article jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  article_id uuid;
  previous_row jsonb;
  saved_row jsonb;
  article_title text := btrim(coalesce(p_article ->> 'title', ''));
  article_category text := nullif(btrim(coalesce(p_article ->> 'category', '')), '');
  article_summary text := nullif(btrim(coalesce(p_article ->> 'summary', '')), '');
  article_thumbnail text := nullif(btrim(coalesce(p_article ->> 'thumbnail_url', '')), '');
  article_mode text := coalesce(nullif(p_article ->> 'content_mode', ''), 'editor');
  article_html text := btrim(coalesce(p_article ->> 'content_html', ''));
  article_published_at timestamptz;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  if char_length(article_title) not between 1 and 160 then
    raise exception 'invalid_article_title' using errcode = '22023';
  end if;
  if article_category is not null and char_length(article_category) > 40 then
    raise exception 'invalid_article_category' using errcode = '22023';
  end if;
  if article_summary is not null and char_length(article_summary) > 500 then
    raise exception 'invalid_article_summary' using errcode = '22023';
  end if;
  if article_mode not in ('editor','html') then
    raise exception 'invalid_article_content_mode' using errcode = '22023';
  end if;
  if char_length(article_html) not between 1 and 200000 then
    raise exception 'invalid_article_content' using errcode = '22023';
  end if;
  -- 팝업 문서와 같은 기준으로 위험한 태그·핸들러를 서버에서도 막는다.
  if article_html ~* '<\s*(script|iframe|object|embed|form|input|button|meta|link|base)(\s|>)'
     or article_html ~* '\son[a-z]+\s*='
     or article_html ~* '(javascript|vbscript):' then
    raise exception 'unsafe_article_html' using errcode = '22023';
  end if;
  -- 썸네일은 http(s) 절대 주소나 사이트 내부 경로만 허용한다.
  if article_thumbnail is not null and article_thumbnail !~* '^(https?://|/)' then
    raise exception 'invalid_article_thumbnail' using errcode = '22023';
  end if;

  article_published_at := coalesce(nullif(p_article ->> 'published_at', '')::timestamptz, now());

  if nullif(p_article ->> 'id', '') is null then
    insert into public.site_articles (
      title, category, summary, thumbnail_url, content_mode, content_html,
      published_at, sort_order, is_active, archived_at, created_by, updated_by
    ) values (
      article_title, article_category, article_summary, article_thumbnail, article_mode, article_html,
      article_published_at,
      coalesce((p_article ->> 'sort_order')::integer, 100),
      coalesce((p_article ->> 'is_active')::boolean, true),
      case when coalesce((p_article ->> 'archived')::boolean, false) then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into article_id;
  else
    article_id := (p_article ->> 'id')::uuid;
    select to_jsonb(a) into previous_row from public.site_articles a where a.id = article_id for update;
    if previous_row is null then raise exception 'article_not_found' using errcode = 'P0002'; end if;

    update public.site_articles
    set title = article_title,
        category = article_category,
        summary = article_summary,
        thumbnail_url = article_thumbnail,
        content_mode = article_mode,
        content_html = article_html,
        published_at = article_published_at,
        sort_order = coalesce((p_article ->> 'sort_order')::integer, 100),
        is_active = coalesce((p_article ->> 'is_active')::boolean, true),
        archived_at = case
          when coalesce((p_article ->> 'archived')::boolean, false) then coalesce(archived_at, now())
          else null
        end,
        updated_by = auth.uid()
    where id = article_id;
  end if;

  select to_jsonb(a) into saved_row from public.site_articles a where a.id = article_id;
  insert into public.audit_logs (actor_user_id, action, target_type, target_id, before_data, after_data)
  values (
    auth.uid(),
    case when previous_row is null then 'site_article.created' else 'site_article.updated' end,
    'site_article', article_id::text,
    previous_row - 'content_html', saved_row - 'content_html');

  return article_id;
end;
$$;

create or replace function public.delete_site_article(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  previous_row jsonb;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  select to_jsonb(a) into previous_row from public.site_articles a where a.id = p_id;
  if previous_row is null then raise exception 'article_not_found' using errcode = 'P0002'; end if;

  delete from public.site_articles where id = p_id;

  insert into public.audit_logs (actor_user_id, action, target_type, target_id, before_data, after_data)
  values (auth.uid(), 'site_article.deleted', 'site_article', p_id::text, previous_row - 'content_html', null);
end;
$$;

-- 썸네일 이미지는 방문자가 로그인 없이 봐야 하므로 공개 버킷에 둔다.
-- 업로드·교체·삭제는 관리자만 할 수 있다.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('public-site-media', 'public-site-media', true, 5242880,
       array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists public_site_media_admin_insert on storage.objects;
create policy public_site_media_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'public-site-media' and public.is_membership_admin());

drop policy if exists public_site_media_admin_update on storage.objects;
create policy public_site_media_admin_update on storage.objects for update to authenticated
using (bucket_id = 'public-site-media' and public.is_membership_admin())
with check (bucket_id = 'public-site-media' and public.is_membership_admin());

drop policy if exists public_site_media_admin_delete on storage.objects;
create policy public_site_media_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'public-site-media' and public.is_membership_admin());

insert into public.site_articles (
  title, category, summary, content_mode, content_html, published_at, sort_order, is_active
)
select
  '재경닷컴 정보 및 동향 안내',
  '안내',
  '이 영역에는 물류 시장 동향과 재경닷컴의 소식이 올라옵니다. 관리자 화면의 "정보 및 동향"에서 글을 추가하면 메인 화면에 바로 노출됩니다.',
  'editor',
  $article$
    <h2>정보 및 동향 영역이 열렸습니다.</h2>
    <p>이 영역은 재경닷컴을 찾아주신 분들께 물류 시장의 최신 동향과 회사 소식을 전하기 위한 공간입니다.</p>
    <h3>이렇게 운영됩니다</h3>
    <ul>
      <li>메인 화면 상단에 카드 형태로 노출되며, 카드를 누르면 본문이 팝업으로 열립니다.</li>
      <li>로그인 없이 누구나 읽을 수 있고, 댓글이나 글쓰기 기능은 제공하지 않습니다.</li>
      <li>글의 등록과 수정은 그룹웨어 관리자 화면에서만 할 수 있습니다.</li>
    </ul>
    <p>궁금하신 점은 언제든 카카오톡 채널로 문의해 주세요.</p>
  $article$,
  now(), 10, true
where not exists (
  select 1 from public.site_articles where title = '재경닷컴 정보 및 동향 안내'
);

revoke all on table public.site_articles from public, anon, authenticated;
revoke all on function public.get_public_site_articles(integer) from public, anon, authenticated;
revoke all on function public.get_public_site_article(uuid) from public, anon, authenticated;
revoke all on function public.get_site_article_admin_catalog() from public, anon, authenticated;
revoke all on function public.manage_site_article(jsonb) from public, anon, authenticated;
revoke all on function public.delete_site_article(uuid) from public, anon, authenticated;

grant execute on function public.get_public_site_articles(integer) to anon, authenticated;
grant execute on function public.get_public_site_article(uuid) to anon, authenticated;
grant execute on function public.get_site_article_admin_catalog() to authenticated;
grant execute on function public.manage_site_article(jsonb) to authenticated;
grant execute on function public.delete_site_article(uuid) to authenticated;

commit;
