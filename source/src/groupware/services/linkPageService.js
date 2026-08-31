import { requireSupabase } from '../lib/supabase.js';

// 링크 페이지 마이그레이션(202608230001_link_pages.sql)이 아직 적용되지 않은
// 환경에서는 RPC 자체가 없다. 대시보드나 관리자 화면 전체가 깨지지 않도록
// 그 경우를 구분 가능한 메시지로 바꿔 던진다.
const MISSING_MESSAGE = '페이지 기능이 아직 데이터베이스에 설치되지 않았습니다. supabase/migrations/202608230001_link_pages.sql을 적용해 주세요.';

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

export const getMyLinkPages = () => rpc('get_my_link_pages').then((data) => data ?? []);
export const getLinkPage = (slug) => rpc('get_link_page', { p_slug: slug });
export const getLinkPageAdminCatalog = () => rpc('admin_get_link_pages').then((data) => data ?? []);
export const saveLinkPage = (page, items) => rpc('manage_link_page', { p_page: page, p_items: items });
export const deleteLinkPage = (pageId) => rpc('delete_link_page', { p_id: pageId });
