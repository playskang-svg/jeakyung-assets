import { requireSupabase } from '../lib/supabase.js';

// Worker 의 구글 연동 API(/api/calendar*, /api/docs). 로그인 토큰을 실어 보내고,
// 구글 토큰은 Worker 안에만 있다.
async function authHeader() {
  const { data } = await requireSupabase().auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ''}` };
}

async function api(path, init = {}) {
  const res = await fetch(path, { ...init, headers: { ...(init.headers || {}), ...(await authHeader()) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || 'failed'), { code: body.error, status: res.status });
  return body;
}

export const getCalendarEvents = (start, end) => api(`/api/calendar?start=${start}&end=${end}`);
export const saveCalendarEvent = (id, formData) => api(id ? `/api/calendar/events/${id}` : '/api/calendar/events', { method: id ? 'PATCH' : 'POST', body: formData });
export const deleteCalendarEvent = (id) => api(`/api/calendar/events/${id}`, { method: 'DELETE' });
export const createGoogleDoc = (type, name) => api('/api/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name }) });

// 첨부파일은 로그인 토큰이 있어야 받으므로 링크 대신 받아서 저장시킨다.
export async function downloadCalendarFile(fileId, name) {
  const res = await fetch(`/api/calendar/file?id=${encodeURIComponent(fileId)}`, { headers: await authHeader() });
  if (!res.ok) throw new Error('download_failed');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = name || 'file';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function getGoogleActivityLogs() {
  const { data, error } = await requireSupabase().rpc('admin_get_google_activity_logs', { p_limit: 300 });
  if (error) throw error;
  return data ?? [];
}

export async function getDocCreateLogs() {
  const { data, error } = await requireSupabase().rpc('get_doc_create_logs', { p_limit: 100 });
  if (error) throw error;
  return data ?? [];
}

export const describeGoogleError = (code) => ({
  invalid_event: '제목과 날짜·시간을 확인해 주세요. 끝 시간은 시작보다 뒤여야 합니다.',
  too_many_files: '첨부파일은 한 번에 5개까지 올릴 수 있습니다.',
  file_too_large: '파일 하나는 20MB까지 올릴 수 있습니다.',
  not_owner: '등록한 사람과 관리자만 고칠 수 있습니다.',
  forbidden: '승인된 회원만 사용할 수 있습니다.',
  not_configured: '구글 연동이 아직 설정되지 않았습니다.',
}[code] || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
