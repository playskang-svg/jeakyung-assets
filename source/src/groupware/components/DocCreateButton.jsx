import { useEffect, useState } from 'react';

import { createGoogleDoc, describeGoogleError, getDocCreateLogs } from '../services/googleService.js';

// 대시보드의 문서 만들기. 동그란 + 단추를 누르면 종류를 고르고, 회사 구글
// 드라이브에 새 구글 문서가 만들어져 새 탭으로 열린다. 누가 무엇을 만들었는지는
// 가운데 '로그보기'를 누르면 팝업으로 보인다.
// 만든 문서가 모이는 공용 폴더(Worker calendar/google.js 의 DOCS_FOLDER_ID 와 같은 폴더).
const DOCS_FOLDER_URL = 'https://drive.google.com/drive/folders/1fO-RtkoocBUQQ4zb6q0KoX4dgREGcQbZ';
const TYPES = [
  { key: 'doc', label: '구글 문서', icon: '📝' },
  { key: 'sheet', label: '스프레드시트', icon: '📊' },
  { key: 'slide', label: '프레젠테이션', icon: '📽️' },
];
const pad = (n) => String(n).padStart(2, '0');
const when = (v) => { const d = new Date(v); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function DocLogDialog({ onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getDocCreateLogs().then(setRows).catch(() => setError('기록을 불러오지 못했습니다.')); }, []);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="gw-target-dialog-layer" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="gw-target-dialog gw-doc-log-dialog" role="dialog" aria-modal="true" aria-label="문서 만들기 기록">
        <header className="gw-target-dialog-bar">
          <div className="gw-target-dialog-title"><strong>문서 만들기 기록</strong>{rows && <span className="gw-count-badge">{rows.length}건</span>}</div>
          <button type="button" className="gw-target-dialog-close" onClick={onClose} aria-label="닫기" autoFocus>×</button>
        </header>
        <div className="gw-target-dialog-body">
          {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
          {!rows && !error && <p className="gw-empty-state">불러오는 중…</p>}
          {rows && rows.length === 0 && <p className="gw-empty-state">아직 기록이 없습니다.</p>}
          {rows && rows.length > 0 && (
            <div className="gw-table-wrap">
              <table className="gw-table">
                <thead><tr><th>일시</th><th>이름</th><th>문서</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{when(r.created_at)}</td>
                      <td>{r.user_name}</td>
                      <td>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a> : r.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function DocCreateButton() {
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [status, setStatus] = useState('');

  const create = async (type) => {
    const today = new Date().toISOString().slice(0, 10);
    const name = window.prompt('파일 이름을 적어 주세요.', `${type.label} ${today}`);
    if (!name || !name.trim()) return;
    // 비동기 뒤에 열면 팝업 차단에 걸리므로 빈 탭을 먼저 연다.
    const tab = window.open('about:blank', '_blank');
    setStatus(`${type.label}을(를) 만드는 중…`); setOpen(false);
    try {
      const doc = await createGoogleDoc(type.key, name.trim());
      if (tab) tab.location.href = doc.url; else window.location.href = doc.url;
      setStatus('');
    } catch (error) {
      tab?.close();
      setStatus(describeGoogleError(error.code));
    }
  };

  return (
    <section className="gw-panel gw-doc-create" aria-label="문서 만들기">
      <div className="gw-doc-create-row">
        <button type="button" className="gw-doc-create-plus" aria-expanded={open} aria-label="문서 만들기" onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true">+</span>
        </button>
        <div>
          <strong>문서 만들기</strong>
          <span className="gw-field-hint">구글 문서·스프레드시트·프레젠테이션을 새로 만들어 회사 구글 드라이브에 저장하고, 새 탭에서 바로 편집합니다.</span>
        </div>
        <button type="button" className="gw-doc-create-log" onClick={() => setLogOpen(true)}>로그보기</button>
        <a className="gw-secondary-button gw-doc-create-folder" href={DOCS_FOLDER_URL} target="_blank" rel="noopener noreferrer" aria-label="작성문서보기, 구글 드라이브 폴더 새 창">작성문서보기 <span aria-hidden="true">↗</span></a>
      </div>
      {open && (
        <div className="gw-doc-create-menu" role="menu">
          {TYPES.map((t) => (
            <button type="button" role="menuitem" key={t.key} onClick={() => create(t)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>
          ))}
        </div>
      )}
      {status && <p className="gw-field-hint gw-doc-create-status" role="status">{status}</p>}
      {logOpen && <DocLogDialog onClose={() => setLogOpen(false)} />}
    </section>
  );
}
