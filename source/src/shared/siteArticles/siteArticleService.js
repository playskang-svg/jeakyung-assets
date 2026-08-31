// 공개 사이트 "소식/정보" 문서 조회.
// 목록은 카드에 필요한 값만 받고, 본문(content_html)은 카드를 눌렀을 때만
// 따로 받아온다. 두 함수 모두 anon 실행이 허용돼 있어 로그인 없이 읽힌다.
export async function getPublicSiteArticles(client, limit = 12) {
  if (!client) return [];
  const { data, error } = await client.rpc('get_public_site_articles', { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

export async function getPublicSiteArticle(client, id) {
  if (!client) return null;
  const { data, error } = await client.rpc('get_public_site_article', { p_id: id });
  if (error) throw error;
  // returns table(...) 형태라 배열로 온다. 없으면 빈 배열.
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}
