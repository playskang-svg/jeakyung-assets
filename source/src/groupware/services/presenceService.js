import { requireSupabase } from '../lib/supabase.js';

// 접속 현황.
//
// "지금 접속해 있다"는 소켓을 열어 두는 방식(Realtime Presence) 대신 하트비트로
// 잰다 — 화면이 열려 있는 동안 touchPresence() 를 주기적으로 부르고, 그 시각이
// 최근이면 접속 중으로 본다. 탭을 그냥 닫아도 몇 분 뒤 자연히 명단에서 빠진다.
async function rpc(name, params = {}) {
  const { data, error } = await requireSupabase().rpc(name, params);
  if (error) throw error;
  return data;
}

export const touchPresence = () => rpc('touch_presence', { p_user_agent: navigator.userAgent?.slice(0, 300) ?? null });
export const getOnlineProfiles = () => rpc('get_online_profiles').then((rows) => rows ?? []);

// 관리자 전용.
export const getMemberLoginSummary = () => rpc('get_member_login_summary').then((rows) => rows ?? []);
export const getMemberLoginEvents = (profileId, limit = 50) =>
  rpc('get_member_login_events', { p_profile_id: profileId, p_limit: limit }).then((rows) => rows ?? []);
