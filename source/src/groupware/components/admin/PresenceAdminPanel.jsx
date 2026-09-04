import { useEffect, useState } from 'react';

import { getMemberLoginEvents, getMemberLoginSummary } from '../../services/presenceService.js';

// 09:41 · 2026.09.03 — 접속 이력 한 줄에 쓰는 형식. 날짜와 시각을 함께 두어
// 여러 날에 걸친 이력에서도 헷갈리지 않는다.
function formatMoment(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 방금(1분 이내), 5분 전, 3시간 전, 2일 전 — 마지막으로 살아 있던 시각을
// 사람이 읽기 쉬운 상대 시간으로 바꾼다.
function timeAgo(value) {
  if (!value) return '기록 없음';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function PresenceAdminPanel() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setMembers(await getMemberLoginSummary()); }
    catch { setError('접속 현황을 불러오지 못했습니다. 활성 관리자 역할을 확인해 주세요.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const select = async (member) => {
    setSelected(member);
    setEvents(null);
    try { setEvents(await getMemberLoginEvents(member.profile_id)); }
    catch { setEvents([]); }
  };

  const onlineCount = members.filter((member) => member.is_online).length;

  return (
    <section className="gw-admin-section" aria-labelledby="presence-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <span className="gw-eyebrow">ACCESS LOG</span>
          <h2 id="presence-admin-title">접속 현황·로그</h2>
          <p>회원별로 지금 접속해 있는지와 지난 로그인 이력을 확인합니다.</p>
        </div>
        <span className="gw-count-badge">지금 {onlineCount}명 접속</span>
      </div>

      {error && <p className="gw-form-status" role="alert">{error}</p>}
      {loading && <p className="gw-empty-state" role="status">불러오는 중…</p>}

      {!loading && (
        <div className="gw-presence-admin-layout">
          <ul className="gw-presence-member-list" aria-label="회원 목록">
            {members.map((member) => (
              <li key={member.profile_id}>
                <button
                  type="button"
                  className={selected?.profile_id === member.profile_id ? 'is-selected' : undefined}
                  onClick={() => select(member)}
                >
                  <span className={`gw-presence-dot${member.is_online ? ' is-online' : ''}`} aria-hidden="true" />
                  <span>
                    <strong>{member.display_name}</strong>
                    <small>{member.department_name || '부서 미등록'} · {member.employee_number || '사번 미등록'}</small>
                  </span>
                  <span className="gw-presence-lastseen">{member.is_online ? '접속 중' : timeAgo(member.last_seen_at)}</span>
                </button>
              </li>
            ))}
            {members.length === 0 && <li className="gw-empty-state">승인된 회원이 없습니다.</li>}
          </ul>

          <div className="gw-presence-detail">
            {!selected && <p className="gw-empty-state">왼쪽에서 회원을 고르면 로그인 이력을 봅니다.</p>}
            {selected && (
              <>
                <h3>{selected.display_name}의 로그인 이력</h3>
                {events === null && <p className="gw-empty-state" role="status">불러오는 중…</p>}
                {events !== null && events.length === 0 && <p className="gw-empty-state">로그인 이력이 없습니다.</p>}
                {events !== null && events.length > 0 && (
                  <ul className="gw-presence-events">
                    {events.map((event, index) => (
                      <li key={`${event.signed_in_at}-${index}`}>
                        <time>{formatMoment(event.signed_in_at)}</time>
                        <span>마지막 활동 {timeAgo(event.last_seen_at)}</span>
                        {event.user_agent && <small>{event.user_agent}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
