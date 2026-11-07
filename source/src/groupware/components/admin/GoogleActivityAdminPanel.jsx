import { useEffect, useState } from 'react';

import { getGoogleActivityLogs } from '../../services/googleService.js';

// 그룹웨어에서 jeakyungdrive01 구글 계정으로 만든 문서와 일정 등록·수정·삭제 기록.
const KIND = { doc_create: '문서 만들기', event_create: '일정 등록', event_update: '일정 수정', event_delete: '일정 삭제' };
const pad = (n) => String(n).padStart(2, '0');
const when = (v) => { const d = new Date(v); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export default function GoogleActivityAdminPanel() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getGoogleActivityLogs().then(setRows).catch(() => setError('기록을 불러오지 못했습니다. 관리자 권한을 확인해 주세요.')); }, []);
  return (
    <section className="gw-admin-section" aria-labelledby="google-log-title">
      <div className="gw-admin-section-heading">
        <div><span className="gw-eyebrow">GOOGLE</span><h2 id="google-log-title">구글 문서·일정 기록</h2></div>
        {rows && <span className="gw-count-badge">{rows.length}건</span>}
      </div>
      <p className="gw-field-hint">대시보드 '문서 만들기'와 사내일정 등록·수정·삭제를 누가 언제 했는지 남깁니다. 파일은 회사 구글 드라이브에 저장됩니다.</p>
      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {rows && rows.length === 0 && <p className="gw-empty-state">아직 기록이 없습니다.</p>}
      {rows && rows.length > 0 && (
        <div className="gw-table-wrap">
          <table className="gw-table">
            <thead><tr><th>일시</th><th>이름</th><th>구분</th><th>파일·일정 이름</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{when(r.created_at)}</td>
                  <td>{r.user_name}</td>
                  <td>{KIND[r.kind] ?? r.kind}</td>
                  <td>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a> : r.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
