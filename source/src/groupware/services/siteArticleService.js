import { requireSupabase } from '../lib/supabase.js';

// 정보 및 동향 마이그레이션(202608290001_site_articles.sql)이 아직 적용되지
// 않은 환경에서는 RPC 자체가 없다. 화면이 깨지지 않도록 구분 가능한 메시지로
// 바꿔 던진다. (버튼 박스 서비스와 같은 방식)
const MISSING_MESSAGE = '정보 및 동향 기능이 아직 데이터베이스에 설치되지 않았습니다. supabase/migrations/202608290001_site_articles.sql을 적용해 주세요.';

const THUMBNAIL_BUCKET = 'public-site-media';

async function rpc(name, params = {}) {
  const { data, error } = await requireSupabase().rpc(name, params);
  if (error) {
    if (error.code === 'PGRST202' || /Could not find the function|does not exist/i.test(error.message ?? '')) {
      throw new Error(MISSING_MESSAGE);
    }
    throw error;
  }
  return data;
}

export const getSiteArticleAdminCatalog = () => rpc('get_site_article_admin_catalog')
  .then((data) => data?.articles ?? []);
export const saveSiteArticle = (article) => rpc('manage_site_article', { p_article: article });
export const deleteSiteArticle = (id) => rpc('delete_site_article', { p_id: id });

// 썸네일은 방문자가 로그인 없이 봐야 해서 공개 버킷에 올리고 공개 URL을 쓴다.
// 업로드 권한은 스토리지 정책에서 관리자만 갖는다.
export async function uploadSiteArticleThumbnail(file) {
  const client = requireSupabase();
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `articles/${crypto.randomUUID()}.${extension || 'jpg'}`;

  const { error } = await client.storage.from(THUMBNAIL_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
