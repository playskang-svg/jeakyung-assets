import { useState } from 'react';

import { createGoogleDoc, describeGoogleError } from '../services/googleService.js';

// 대시보드의 문서 만들기. 동그란 + 단추를 누르면 종류를 고르고, jeakyungdrive01
// 드라이브 루트에 새 구글 문서가 만들어져 새 탭으로 열린다. 누가 만들었는지는
// 관리자 화면 '구글 문서·일정 기록'에 남는다.
const TYPES = [
  { key: 'doc', label: '구글 문서', icon: '📝' },
  { key: 'sheet', label: '스프레드시트', icon: '📊' },
  { key: 'slide', label: '프레젠테이션', icon: '📽️' },
];

export default function DocCreateButton() {
  const [open, setOpen] = useState(false);
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
      setStatus(`'${doc.name}'을(를) 만들었습니다. 드라이브에 저장됩니다.`);
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
          <span className="gw-field-hint">구글 문서·스프레드시트·프레젠테이션을 새로 만들어 회사 드라이브에 저장합니다.</span>
        </div>
      </div>
      {open && (
        <div className="gw-doc-create-menu" role="menu">
          {TYPES.map((t) => (
            <button type="button" role="menuitem" key={t.key} onClick={() => create(t)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>
          ))}
        </div>
      )}
      {status && <p className="gw-field-hint" role="status">{status}</p>}
    </section>
  );
}
