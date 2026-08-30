import { useEffect, useRef, useState } from 'react';

import PopupDocumentContent from '../../../shared/popup/PopupDocumentContent.jsx';
import '../../../shared/popup/popup.css';

// 히어로 바로 아래 "정보 및 동향" 영역.
// 카드에는 썸네일과 요약만 노출하고, 카드를 누르면 본문을 따로 받아 팝업으로
// 보여준다. 방문자는 로그인 없이 읽기만 하며 댓글·작성 기능은 없다.
//
// supabase-js는 마케팅 페이지 초기 번들에 넣지 않는다(팝업 레이어와 같은 이유).
// 화면이 뜬 뒤에 따로 받아와서 목록을 채운다.
const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

function ArticleDialog({ article, detail, loading, error, onClose }) {
  const closeButtonRef = useRef(null);

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
        aria-labelledby={`news-dialog-title-${article.id}`}
      >
        <header>
          <div className="site-news-dialog-heading">
            {article.category && <span className="site-news-chip">{article.category}</span>}
            <h2 id={`news-dialog-title-${article.id}`}>{article.title}</h2>
            <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="site-popup-body">
          {loading && <p className="site-news-dialog-state" role="status">본문을 불러오고 있습니다.</p>}
          {!loading && error && <p className="site-news-dialog-state" role="alert">{error}</p>}
          {!loading && !error && detail && <PopupDocumentContent html={detail.content_html} />}
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

export default function NewsSection() {
  const [articles, setArticles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const clientRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ publicSupabase }, { getPublicSiteArticles }] = await Promise.all([
          import('../../../shared/supabaseAnon.js'),
          import('../../../shared/siteArticles/siteArticleService.js'),
        ]);
        if (!alive) return;
        if (!publicSupabase) { setLoaded(true); return; }
        clientRef.current = publicSupabase;
        const items = await getPublicSiteArticles(publicSupabase, 9);
        if (alive) setArticles(items);
      } catch {
        /* 목록을 못 받아도 페이지는 그대로 두고 빈 안내만 보여준다. */
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const openArticle = async (article) => {
    setActive(article);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const { getPublicSiteArticle } = await import('../../../shared/siteArticles/siteArticleService.js');
      const found = await getPublicSiteArticle(clientRef.current, article.id);
      if (!found) throw new Error('not_found');
      setDetail(found);
    } catch {
      setDetailError('본문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="news section" id="news" aria-labelledby="news-title">
      <div className="content-width">
        <div className="section-heading news-heading">
          <span className="eyebrow"><i /> Insight &amp; Trends</span>
          <h2 id="news-title">정보 및 동향</h2>
          <p>물류 시장의 흐름과 재경닷컴의 소식을 전해드립니다. 카드를 누르면 전체 내용을 볼 수 있습니다.</p>
          <a className="news-all-link" href="news/">전체 보기 <span aria-hidden="true">→</span></a>
        </div>

        {!loaded && (
          <ul className="news-grid" aria-hidden="true">
            {[0, 1, 2].map((key) => <li key={key}><span className="news-card news-card--skeleton" /></li>)}
          </ul>
        )}

        {loaded && articles.length === 0 && (
          <p className="news-empty">준비 중입니다. 곧 새로운 소식으로 찾아뵙겠습니다.</p>
        )}

        {loaded && articles.length > 0 && (
        <ul className="news-grid">
          {articles.map((article) => (
            <li key={article.id}>
              <button type="button" className="news-card" onClick={() => openArticle(article)}>
                <span className="news-card-thumb">
                  {article.thumbnail_url
                    ? <img src={article.thumbnail_url} alt="" loading="lazy" decoding="async" />
                    : <span className="news-card-thumb-fallback" aria-hidden="true">JEAKYUNG</span>}
                </span>
                <span className="news-card-body">
                  <span className="news-card-meta">
                    {article.category && <span className="site-news-chip">{article.category}</span>}
                    <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
                  </span>
                  <strong>{article.title}</strong>
                  {article.summary && <span className="news-card-summary">{article.summary}</span>}
                  <span className="news-card-more">자세히 보기 <i aria-hidden="true">→</i></span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        )}
      </div>

      {active && (
        <ArticleDialog
          article={active}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}
