import { useEffect, useRef, useState } from 'react';

import PopupDocumentContent from './PopupDocumentContent.jsx';
import { getActivePopupDocuments } from './popupService.js';
import './popup.css';

const storageKeySession = (id) => `jeakyung-popup-dismissed:${id}`;
const storageKey7Days = (id) => `jeakyung-popup-dismissed-7days:${id}`;

const wasDismissed = (id) => {
  try {
    if (sessionStorage.getItem(storageKeySession(id)) === '1') return true;
    const untilStr = localStorage.getItem(storageKey7Days(id));
    if (untilStr) {
      const until = Number(untilStr);
      if (Date.now() < until) return true;
      localStorage.removeItem(storageKey7Days(id));
    }
  } catch { /* ignore storage error */ }
  return false;
};

const rememberDismissalSession = (id) => {
  try { sessionStorage.setItem(storageKeySession(id), '1'); } catch { /* ignore */ }
};

const rememberDismissal7Days = (id) => {
  try {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(storageKey7Days(id), String(Date.now() + sevenDaysMs));
  } catch { /* ignore */ }
};

export default function PopupLayer({ client, target }) {
  const [documents, setDocuments] = useState([]);
  const closeButtonRef = useRef(null);
  const current = documents[0];

  useEffect(() => {
    let active = true;
    getActivePopupDocuments(client, target).then((items) => {
      if (!active) return;
      setDocuments(items.filter((item) => !wasDismissed(item.id)));
    }).catch(() => { if (active) setDocuments([]); });
    return () => { active = false; };
  }, [client, target]);

  useEffect(() => {
    if (!current) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === 'Escape') closeCurrent(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [current?.id]);

  const closeCurrent = () => {
    if (!current) return;
    rememberDismissalSession(current.id);
    setDocuments((items) => items.slice(1));
  };

  const dismiss7DaysAndClose = () => {
    if (!current) return;
    rememberDismissal7Days(current.id);
    rememberDismissalSession(current.id);
    setDocuments((items) => items.slice(1));
  };

  if (!current) return null;

  return (
    <div className="site-popup-layer" role="presentation">
      <section className={`site-popup-dialog site-popup-dialog--${current.size ?? 'medium'}`} role="dialog" aria-modal="true" aria-labelledby={`popup-title-${current.id}`}>
        <header>
          <h2 id={`popup-title-${current.id}`}>{current.title}</h2>
          <button ref={closeButtonRef} type="button" onClick={closeCurrent} aria-label="팝업 닫기">×</button>
        </header>
        <div className="site-popup-body">
          <PopupDocumentContent html={current.content_html} />
        </div>
        <footer>
          <button type="button" className="site-popup-7days-btn" onClick={dismiss7DaysAndClose}>
            7일간 표시하지 않기
          </button>
          <div className="site-popup-footer-actions">
            {documents.length > 1 && <span>다음 안내 {documents.length - 1}개</span>}
            <button type="button" onClick={closeCurrent}>닫기</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
