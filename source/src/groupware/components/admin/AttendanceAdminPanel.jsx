import { useEffect, useMemo, useState } from 'react';

import { formatClock, formatDuration, getMemberAttendance, todayKey } from '../../services/attendanceService.js';
import { getMemberLoginSummary } from '../../services/presenceService.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (workDate) => {
  const date = new Date(`${workDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return workDate;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
};

// 기본 기간은 최근 31일 — 서버 기본값과 맞춘다.
function defaultRange() {
  const to = todayKey();
  const [year, month, day] = to.split('-').map(Number);
  const from = new Date(year, month - 1, day - 30);
  const pad = (n) => String(n).padStart(2, '0');
  return { from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`, to };
}

export default function AttendanceAdminPanel() {
  const [range, setRange] = useState(defaultRange);
  const [profileId, setProfileId] = useState('');
  const [members, setMembers] = useState([]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { getMemberLoginSummary().then(setMembers).catch(() => {}); }, []);

  const load = async () => {
    setRows(null); setError('');
    try {
      setRows(await getMemberAttendance(profileId || null, range.from, range.to));
    } catch {
      setRows([]);
      setError('출퇴근 기록을 불러오지 못했습니다. 활성 관리자 역할을 확인해 주세요.');
    }
  };
  useEffect(() => { load(); }, []);

  // 근무 시간 합계는 출근·퇴근이 모두 찍힌 줄만 센다.
  const summary = useMemo(() => {
    if (!rows) return null;
    const closed = rows.filter((row) => row.worked_minutes !== null && row.worked_minutes !== undefined);
    return { rows: rows.length, closed: closed.length, minutes: closed.reduce((sum, row) => sum + row.worked_minutes, 0) };
  }, [rows]);

  return (
    <section className="gw-admin-section" aria-labelledby="attendance-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <span className="gw-eyebrow">ATTENDANCE</span>
          <h2 id="attendance-admin-title">출퇴근 등록 기록</h2>
          <p>전체 회원의 출근·퇴근 기록입니다. 서버에 한 번 적힌 시각은 이 화면에서도 고칠 수 없습니다.</p>
        </div>
        {summary && <span className="gw-count-badge">{summary.rows}건</span>}
      </div>

      <form className="gw-employee-search" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className="gw-field"><span>회원</span>
          <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
            <option value="">전체 회원</option>
            {members.map((member) => <option key={member.profile_id} value={member.profile_id}>{member.display_name}</option>)}
          </select>
        </label>
        <label className="gw-field"><span>시작일</span><input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
        <label className="gw-field"><span>종료일</span><input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
        <button className="gw-secondary-button" type="submit">조회</button>
      </form>

      {error && <p className="gw-form-status" role="alert">{error}</p>}

      {summary && summary.rows > 0 && (
        <dl className="gw-attendance-summary">
          <div><dt>조회된 기록</dt><dd>{summary.rows}건</dd></div>
          <div><dt>출·퇴근 모두</dt><dd>{summary.closed}건</dd></div>
          <div><dt>근무 시간 합계</dt><dd>{formatDuration(summary.minutes) || '0분'}</dd></div>
        </dl>
      )}

      {rows === null && <p className="gw-empty-state" role="status">불러오는 중…</p>}
      {rows !== null && rows.length === 0 && !error && <p className="gw-empty-state">이 조건에 해당하는 기록이 없습니다.</p>}

      {rows !== null && rows.length > 0 && (
        <div className="gw-attendance-table-wrap">
          <table className="gw-attendance-table">
            <thead>
              <tr><th scope="col">이름</th><th scope="col">부서</th><th scope="col">날짜</th><th scope="col">출근</th><th scope="col">퇴근</th><th scope="col">근무 시간</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.profile_id}-${row.work_date}`}>
                  <th scope="row">{row.display_name}</th>
                  <td>{row.department_name || <span className="gw-attendance-blank">—</span>}</td>
                  <td>{dayLabel(row.work_date)}</td>
                  <td>{formatClock(row.checked_in_at) || <span className="gw-attendance-blank">—</span>}</td>
                  <td>{formatClock(row.checked_out_at) || <span className="gw-attendance-blank">—</span>}</td>
                  <td>{formatDuration(row.worked_minutes) || <span className="gw-attendance-blank">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
