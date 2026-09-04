import { requireSupabase } from '../lib/supabase.js';

// 출퇴근 기록.
//
// 시각은 서버가 찍는다. 브라우저 시계는 사람이 바꿀 수 있어서, 화면에서 보낸
// 시각을 그대로 적으면 기록의 뜻이 없어진다. 그래서 이 함수들은 "지금 찍어
// 달라"고만 하고 값을 보내지 않는다.
//
// 한 번 적힌 시각은 고칠 수 없다. 고치는 함수도 두지 않았다.
async function rpc(name, params = {}) {
  const { data, error } = await requireSupabase().rpc(name, params);
  if (error) throw error;
  return data;
}

export const punchIn = () => rpc('punch_in');
export const punchOut = () => rpc('punch_out');

// 기간을 주지 않으면 최근 31일.
export const getMyAttendance = (from = null, to = null) =>
  rpc('get_my_attendance', { p_from: from, p_to: to }).then((rows) => rows ?? []);

// 관리자 전용 — 전체(또는 한 사람) 출퇴근 기록. profileId 를 주지 않으면 전체,
// 기간을 주지 않으면 최근 31일.
export const getMemberAttendance = (profileId = null, from = null, to = null, limit = 500) =>
  rpc('get_member_attendance', { p_profile_id: profileId, p_from: from, p_to: to, p_limit: limit }).then((rows) => rows ?? []);

// 오늘 하루치. 카드에 걸 값이라 한 건만 받는다.
export async function getTodayAttendance() {
  const today = todayKey();
  const rows = await getMyAttendance(today, today);
  return rows[0] ?? null;
}

// 한국 시각 기준 오늘. 서버가 날짜를 끊는 기준과 같아야 어제 기록을 오늘로
// 잘못 묻지 않는다.
export function todayKey(now = new Date()) {
  const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const pad = (value) => String(value).padStart(2, '0');
  return `${seoul.getFullYear()}-${pad(seoul.getMonth() + 1)}-${pad(seoul.getDate())}`;
}

// 09:02 — 초는 버린다. 분 단위면 충분하고, 초까지 적으면 줄이 길어진다.
export function formatClock(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 505 → "8시간 25분". 근무 시간 칸에 쓴다.
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}분`;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}
