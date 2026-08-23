import { requireSupabase } from '../lib/supabase.js';

// 버튼 박스 마이그레이션(202608231000_button_boxes.sql)이 아직 적용되지 않은
// 환경에서는 RPC 자체가 없다. 화면 전체가 깨지지 않도록 그 경우를 구분 가능한
// 메시지로 바꿔 던진다.
const MISSING_MESSAGE = '버튼 박스 기능이 아직 데이터베이스에 설치되지 않았습니다. supabase/migrations/202608231000_button_boxes.sql을 적용해 주세요.';

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

export const getButtonBox = (id) => rpc('get_button_box', { p_id: id });
export const getButtonBoxAdminCatalog = () => rpc('admin_get_button_boxes').then((data) => data ?? []);
export const saveButtonBox = (box, items) => rpc('manage_button_box', { p_box: box, p_items: items });
export const deleteButtonBox = (boxId) => rpc('delete_button_box', { p_id: boxId });
