import { useEffect, useMemo, useState } from 'react';

import { formatClock, formatDuration, getMyAttendance, todayKey } from '../../services/attendanceService.js';

// 내 출퇴근 기록. 남의 기록은 서버에서 아예 오지 않는다(본인 것만 읽도록
// 막아 두었다). 고치는 기능은 두지 않는다 — 고칠 수 있으면 기록이 아니다.

const MONTHS = 6;

// 2026-09 → '2026년 9월'
const monthLabel = (key) => {
  const [year, month] = key.split('-');
  return `${year}년 ${Number(month)}월`;
};

// 그 달의 첫날과 마지막 날.
const monthRange = (key) => {
  const [year, month] = key.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return [`${key}-01`, `${year}-${pad(month)}-${pad(last)}`];
};

// 최근 몇 달치 목록. 오늘이 속한 달부터 거슬러 올라간다.
const buildMonths = (count) => {
  const [year, month] = todayKey().split('-').map(Number);
  const list = [];
  for (let step = 0; step < count; step += 1) {
    const date = new Date(year, month - 1 - step, 1);
    list.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return list;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (workDate) => {
  const date = new Date(`${workDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return workDate;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
};

export default function AttendancePage() {
  const months = useMemo(() => buildMonths(MONTHS), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError('');
    const [from, to] = monthRange(month);
    getMyAttendance(from, to)
      .then((data) => { if (alive) setRows(data); })
      .catch((cause) => { if (alive) { setRows([]); setError(cause?.message || '기록을 불러오지 못했습니다.'); } });
    return () => { alive = false; };
  }, [month]);

  // 합계는 출근·퇴근이 모두 찍힌 날만 센다. 한쪽만 있는 날을 0으로 세면
  // 근무 시간이 실제보다 적어 보인다.
  const summary = useMemo(() => {
    if (!rows) return null;
    const closed = rows.filter((row) => row.worked_minutes !== null && row.worked_minutes !== undefined);
    const minutes = closed.reduce((sum, row) => sum + row.worked_minutes, 0);
    return { days: rows.length, closed: closed.length, minutes };
  }, [rows]);

  return (
    <article className="gw-page gw-attendance-page" aria-labelledby="attendance-title">
      <header className="gw-page-header">
        <div>
          <h1 id="attendance-title">내 출퇴근 기록</h1>
          <p>기록한 시각은 고칠 수 없습니다. 잘못된 기록이 있으면 관리자에게 알려 주세요.</p>
        </div>
      </header>

      <nav className="gw-attendance-months" aria-label="월 선택">
        {months.map((key) => (
          <button
            key={key}
            type="button"
            className={`gw-attendance-month${key === month ? ' is-active' : ''}`}
            aria-pressed={key === month}
            onClick={() => setMonth(key)}
          >
            {monthLabel(key)}
          </button>
        ))}
      </nav>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}

      {summary && summary.days > 0 && (
        <dl className="gw-attendance-summary">
          <div><dt>기록한 날</dt><dd>{summary.days}일</dd></div>
          <div><dt>출·퇴근 모두</dt><dd>{summary.closed}일</dd></div>
          <div><dt>근무 시간 합계</dt><dd>{formatDuration(summary.minutes) || '0분'}</dd></div>
        </dl>
      )}

      {rows === null && <p className="gw-empty-state">불러오는 중…</p>}
      {rows !== null && rows.length === 0 && !error && (
        <p className="gw-empty-state">이 달에 기록한 출퇴근이 없습니다.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="gw-attendance-table-wrap">
          <table className="gw-attendance-table">
            <caption className="gw-visually-hidden">{monthLabel(month)} 출퇴근 기록</caption>
            <thead>
              <tr><th scope="col">날짜</th><th scope="col">출근</th><th scope="col">퇴근</th><th scope="col">근무 시간</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.work_date}>
                  <th scope="row">{dayLabel(row.work_date)}</th>
                  <td>{formatClock(row.checked_in_at) || <span className="gw-attendance-blank">—</span>}</td>
                  <td>{formatClock(row.checked_out_at) || <span className="gw-attendance-blank">—</span>}</td>
                  <td>{formatDuration(row.worked_minutes) || <span className="gw-attendance-blank">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
