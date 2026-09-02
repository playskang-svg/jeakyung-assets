import { requireSupabase } from '../lib/supabase.js';

// quick_links 마이그레이션이 아직 적용되지 않은 환경에서는 RPC 자체가 없다.
// 대시보드가 통째로 깨지지 않도록 그 경우를 구분 가능한 메시지로 바꿔 던진다.
const MISSING_MESSAGE = '페이지 이동 기능이 아직 데이터베이스에 설치되지 않았습니다. supabase/migrations/202609020011_quick_links.sql을 적용해 주세요.';

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

export const getQuickLinks = () => rpc('get_quick_links').then((data) => data ?? []);
export const getQuickLinkAdminList = () => rpc('admin_get_quick_links').then((data) => data ?? []);
export const saveQuickLink = (link) => rpc('manage_quick_link', { p_link: link });
export const removeQuickLink = (id) => rpc('delete_quick_link', { p_id: id });
