import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatClock, getTodayAttendance, punchIn, punchOut } from '../../services/attendanceService.js';

// 프로필 카드 안의 출퇴근 칸.
//
// 누르면 그 순간의 서버 시각이 남고, 남은 뒤에는 고칠 수 없다. 되돌릴 수 없는
// 일이라 한 번 더 묻는다 — 잘못 누른 시각이 그대로 박히면 손쓸 방법이 없다.
//
// 찍고 나면 단추 자리에 시각이 그대로 남는다. 오늘 몇 시에 왔는지가 이 칸의
// 목적이므로, 다 찍은 뒤에도 빈 자리가 되지 않아야 한다.
// 3:15 — 출근 이후 흐른 시간. 한 시간이 안 되면 분만 남긴다(상단바 "접속
// N분" 표시와 같은 규칙이라, 두 시계가 서로 다른 형식으로 읽히지 않는다).
function elapsedSince(fromIso, nowMs) {
  const minutes = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}:${String(minutes % 60).padStart(2, '0')}` : `${minutes}분`;
}

export default function AttendancePunch() {
  const [record, setRecord] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    getTodayAttendance()
      .then((row) => { if (alive) setRecord(row); })
      .catch(() => { /* 못 받아도 카드는 그대로 둔다. 단추는 눌러 볼 수 있다. */ })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  // 출근했지만 아직 퇴근 전일 때만 흘러간다 — 퇴근을 찍은 뒤에는 근무 시간이
  // 더 늘어나면 안 된다.
  const working = Boolean(record?.checked_in_at) && !record?.checked_out_at;
  useEffect(() => {
    if (!working) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [working]);

  const punch = async (kind) => {
    const label = kind === 'in' ? '출근' : '퇴근';
    const now = new Date();
    const clock = formatClock(now.toISOString());
    if (!window.confirm(`${clock} 으로 ${label}을 기록합니다.\n한 번 기록한 시각은 고칠 수 없습니다. 계속할까요?`)) return;
    setBusy(kind);
    setError('');
    try {
      const row = kind === 'in' ? await punchIn() : await punchOut();
      setRecord(row);
    } catch (cause) {
      setError(cause?.message || `${label}을 기록하지 못했습니다.`);
      // 다른 기기에서 이미 찍었을 수 있다. 서버 값을 다시 받아 화면을 맞춘다.
      getTodayAttendance().then((row) => setRecord(row)).catch(() => {});
    } finally {
      setBusy('');
    }
  };

  const slot = (kind) => {
    const done = kind === 'in' ? record?.checked_in_at : record?.checked_out_at;
    const label = kind === 'in' ? '출근' : '퇴근';
    if (done) {
      return (
        <p className="gw-punch-slot is-done">
          <span>{label}</span>
          <time dateTime={done}>{formatClock(done)}</time>
          {/* 출근한 뒤 퇴근 전에만 보인다 — 지금 몇 시고, 출근한 뒤 얼마나
              흘렀는지를 실시간으로 보여준다. */}
          {kind === 'in' && working && (
            <span className="gw-punch-live">
              <time dateTime={now.toISOString()}>{formatClock(now.toISOString())}</time>
              <span className="gw-punch-elapsed">근무 {elapsedSince(done, now.getTime())}</span>
            </span>
          )}
        </p>
      );
    }
    // 퇴근은 출근을 찍은 뒤에만 누를 수 있다. 서버도 같은 규칙으로 막는다.
    const blocked = kind === 'out' && !record?.checked_in_at;
    return (
      <p className="gw-punch-slot">
        <button
          type="button"
          className="gw-punch-button"
          onClick={() => punch(kind)}
          disabled={!loaded || blocked || busy !== ''}
          title={blocked ? '출근을 먼저 기록해 주세요.' : `${label} 기록`}
        >
          {busy === kind ? '기록 중…' : label}
        </button>
      </p>
    );
  };

  return (
    <div className="gw-punch">
      <div className="gw-punch-slots">
        {slot('in')}
        <span className="gw-punch-divider" aria-hidden="true" />
        {slot('out')}
      </div>
      <Link className="gw-punch-more" to="/attendance">내 기록</Link>
      {error && <p className="gw-punch-error" role="alert">{error}</p>}
    </div>
  );
}
