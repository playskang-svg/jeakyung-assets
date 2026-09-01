-- 관리자 저장 경로에도 작성자를 넣는다. 나머지 검사는 그대로 둔다.
-- (<style> 은 막지 않는다. 화면에 그릴 때 선택자를 글 영역 안으로 가두므로
--  바깥 요소를 건드릴 수 없고, 스크립트·이벤트 속성은 아래 검사가 계속 막는다.)
create or replace function public.manage_site_article(p_article jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  article_id uuid;
  previous_row jsonb;
  saved_row jsonb;
  article_title text := btrim(coalesce(p_article ->> 'title', ''));
  article_category text := nullif(btrim(coalesce(p_article ->> 'category', '')), '');
  article_summary text := nullif(btrim(coalesce(p_article ->> 'summary', '')), '');
  article_author text := nullif(btrim(coalesce(p_article ->> 'author', '')), '');
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
  if article_author is not null and char_length(article_author) > 60 then
    raise exception 'invalid_article_author' using errcode = '22023';
  end if;
  if article_mode not in ('editor','html') then
    raise exception 'invalid_article_content_mode' using errcode = '22023';
  end if;
  if char_length(article_html) not between 1 and 200000 then
    raise exception 'invalid_article_content' using errcode = '22023';
  end if;
  if article_html ~* '<\s*(script|iframe|object|embed|form|input|button|meta|link|base)(\s|>)'
     or article_html ~* '\son[a-z]+\s*='
     or article_html ~* '(javascript|vbscript):' then
    raise exception 'unsafe_article_html' using errcode = '22023';
  end if;
  if article_thumbnail is not null and article_thumbnail !~* '^(https?://|/)' then
    raise exception 'invalid_article_thumbnail' using errcode = '22023';
  end if;

  article_published_at := coalesce(nullif(p_article ->> 'published_at', '')::timestamptz, now());

  if nullif(p_article ->> 'id', '') is null then
    insert into public.site_articles (
      title, category, summary, author, thumbnail_url, content_mode, content_html,
      published_at, sort_order, is_active, archived_at, created_by, updated_by
    ) values (
      article_title, article_category, article_summary, article_author, article_thumbnail,
      article_mode, article_html, article_published_at,
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
        author = article_author,
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
