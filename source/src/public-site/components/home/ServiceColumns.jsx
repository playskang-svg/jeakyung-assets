import { useCallback, useEffect, useRef, useState } from 'react';

import PopupDocumentContent from '../../../shared/popup/PopupDocumentContent.jsx';
import '../../../shared/popup/popup.css';

// 서비스 카드 안에 붙는 칼럼 띠.
//
// 그 서비스만의 글을 정사각 썸네일로 늘어놓고, 누르면 팝업으로 본문을 연다.
// 글이 없으면 아무것도 그리지 않는다 — 아직 글을 쓰지 않은 카드에 빈 자리가
// 생기면 미완성으로 보인다.
//
// 목록은 화면이 뜬 뒤에 따로 받는다. supabase-js 를 마케팅 페이지 첫 묶음에
// 넣지 않으려는 것으로, 소식/정보 영역과 같은 방식이다.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
};

// 본문에 <div data-youtube="영상번호"> 가 있으면 재생틀로 바꿔 끼운다.
//
// 본문 청소기는 iframe 을 통째로 버린다(남의 주소가 우리 화면 안에서 열리는
// 통로라서). 그래서 글에는 영상 번호만 남기고, 재생 주소는 여기서 만든다.
// 번호가 열한 글자 규격에 맞지 않으면 그냥 지운다.
function useYouTubeSwap(ref, html) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('[data-youtube]').forEach((holder) => {
      const videoId = holder.getAttribute('data-youtube') ?? '';
      if (!YOUTUBE_ID.test(videoId)) { holder.remove(); return; }
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
      frame.title = holder.getAttribute('data-title') || '영상';
      frame.loading = 'lazy';
      frame.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      const box = document.createElement('div');
      box.className = 'site-article-video';
      box.appendChild(frame);
      holder.replaceWith(box);
    });
  }, [ref, html]);
}

function ArticleBody({ html }) {
  const ref = useRef(null);
  useYouTubeSwap(ref, html);
  return <div ref={ref}><PopupDocumentContent html={html} /></div>;
}

function ColumnDialog({ article, detail, loading, error, onClose }) {
  const closeButtonRef = useRef(null);

  // 열리면 뒤 배경이 따라 움직이지 않게 잠그고, 닫으면 원래대로 돌린다.
  // Esc 로도 닫힌다 — 팝업에서 나가는 길은 여러 개여야 한다.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="site-popup-layer"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        className="site-popup-dialog site-popup-dialog--large site-news-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`column-dialog-title-${article.id}`}
      >
        <header>
          <div className="site-news-dialog-heading">
            {article.category && <span className="site-news-chip">{article.category}</span>}
            <h2 id={`column-dialog-title-${article.id}`}>{article.title}</h2>
            <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="site-popup-body">
          {loading && <p className="site-news-dialog-state" role="status">본문을 불러오고 있습니다.</p>}
          {!loading && error && <p className="site-news-dialog-state" role="alert">{error}</p>}
          {!loading && !error && detail && <ArticleBody html={detail.content_html} />}
        </div>
        <footer>
          <div className="site-popup-footer-actions">
            <button type="button" onClick={onClose}>닫기</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function ServiceColumns({ serviceKey, serviceName }) {
  const [articles, setArticles] = useState([]);
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const trackRef = useRef(null);
  const clientRef = useRef(null);
  // 넘길 것이 없으면 화살표를 아예 그리지 않는다. 눌러도 안 움직이는 단추가
  // 있으면 고장으로 보인다.
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ publicSupabase }, { getPublicServiceArticles }] = await Promise.all([
          import('../../../shared/supabaseAnon.js'),
          import('../../../shared/siteArticles/siteArticleService.js'),
        ]);
        if (!alive || !publicSupabase) return;
        clientRef.current = publicSupabase;
        const items = await getPublicServiceArticles(publicSupabase, serviceKey, 12);
        if (alive) setArticles(items);
      } catch {
        /* 목록을 못 받아도 카드는 그대로 둔다. 없어도 되는 자리다. */
      }
    })();
    return () => { alive = false; };
  }, [serviceKey]);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [articles, measure]);

  const nudge = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth - 40, 120), behavior: 'smooth' });
  };

  const openArticle = async (article) => {
    setActive(article);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const { getPublicSiteArticle } = await import('../../../shared/siteArticles/siteArticleService.js');
      const found = await getPublicSiteArticle(clientRef.current, article.id);
      if (!found) throw new Error('not-found');
      setDetail(found);
    } catch {
      setDetailError('본문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (articles.length === 0) return null;
  const canScroll = !(edge.start && edge.end);

  return (
    <div className="service-columns">
      <p className="service-columns-label">{serviceName} 이야기</p>
      <div className="service-columns-strip">
        {canScroll && (
          <button
            type="button" className="service-columns-nav service-columns-nav--prev"
            aria-label="이전 글 보기" disabled={edge.start} onClick={() => nudge(-1)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M16 4.5v15L6 12z" fill="currentColor" /></svg>
          </button>
        )}
        <ul className="service-columns-track" ref={trackRef} onScroll={measure}>
          {articles.map((article) => (
            <li key={article.id}>
              <button type="button" onClick={() => openArticle(article)} title={article.title}>
                <span className="service-columns-shot">
                  {article.thumbnail_url
                    ? <img src={article.thumbnail_url} alt="" loading="lazy" />
                    : <span className="service-columns-blank" aria-hidden="true" />}
                </span>
                <strong>{article.title}</strong>
              </button>
            </li>
          ))}
        </ul>
        {canScroll && (
          <button
            type="button" className="service-columns-nav service-columns-nav--next"
            aria-label="다음 글 보기" disabled={edge.end} onClick={() => nudge(1)}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 4.5v15l10-7.5z" fill="currentColor" /></svg>
          </button>
        )}
      </div>

      {active && (
        <ColumnDialog
          article={active}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => { setActive(null); setDetail(null); setDetailError(''); }}
        />
      )}
    </div>
  );
}
