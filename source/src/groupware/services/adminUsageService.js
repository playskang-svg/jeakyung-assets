import { requireSupabase } from '../lib/supabase.js';

export async function getAdminSystemUsage() {
  const client = requireSupabase();
  const [usage, details] = await Promise.all([
    client.rpc('get_admin_system_usage'),
    client.rpc('get_admin_file_cleanup_details'),
  ]);
  if (usage.error) throw usage.error;
  if (details.error) throw details.error;
  return { ...usage.data, file_details: details.data ?? { largest_file: null, cleanup_candidates: [] } };
}

// 지운 첨부파일을 저장소에서 실제로 없앤다.
//
// 기록에 지움 표시를 하는 것만으로는 파일이 남는다. 저장소 행을 SQL 로 지워도
// 마찬가지다. 실제 삭제는 Storage API 를 거쳐야 하므로 서비스 역할로 도는 엣지
// 함수에 맡긴다. 호출자의 세션이 그대로 전달되고, 함수 쪽에서 최고관리자인지
// 다시 확인한다.
export async function runAttachmentCleanup({ dryRun = false } = {}) {
  const { data, error } = await requireSupabase().functions.invoke('board-attachment-cleanup', {
    body: { dryRun },
  });
  if (error) {
    // 엣지 함수는 실패 사유를 본문에 담아 보낸다. error.message 만 보면
    // "non-2xx status code" 라는 말만 남아 무엇이 문제인지 알 수 없다.
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message || '정리를 실행하지 못했습니다.');
  }
  return data;
}
