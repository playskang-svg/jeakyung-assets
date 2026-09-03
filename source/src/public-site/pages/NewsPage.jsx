import { useCallback, useEffect, useState } from 'react';

import { serviceName, withObjectParticle } from '../data/services.js';
import PopupDocumentContent from '../../shared/popup/PopupDocumentContent.jsx';
import '../../shared/popup/popup.css';

// 소식/정보 전용 페이지. 분류 탭으로 목록을 거르고, 글을 누르면 같은
// 화면에서 본문이 열린다. 뒤로가기 / 목록 보기 / 닫기와 브라우저 뒤로가기가
// 모두 목록으로 돌아온다.
const ALL = '__all__';

// 목록 위에 한 줄로 놓는 자료 링크. 소식 글이 아니라 바깥 문서로 나가므로
// 썸네일 없이 제목만 두고 새 탭으로 연다.
const DOCUMENT_LINKS = [
  { label: '회사소개서(2025)', href: 'https://jeakyung.quv.kr/21' },
  { label: '컨설팅소개서(2025)', href: 'https://jeakyung.quv.kr/48' },
];
const ARTICLE_LIMIT = 50;

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const articleParam = () => new URLSearchParams(window.location.search).get('article');
// ?service=3pl 로 들어오면 소식/정보 대신 그 서비스의 칼럼 목록을 연다.
// 서비스 카드의 썸네일이 이 주소로 보낸다.
const serviceParam = () => new URLSearchParams(window.location.search).get('service');

export default function NewsPage() {
  // 어느 서비스의 목록인지는 주소로 정해지고 화면이 사는 동안 바뀌지 않는다.
  const [service] = useState(() => serviceParam());
  const heading = serviceName(service);
  const [articles, setArticles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState(ALL);
  const [openId, setOpenId] = useState(() => articleParam());
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState('idle');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ publicSupabase }, articleApi] = await Promise.all([
          import('../../shared/supabaseAnon.js'),
          import('../../shared/siteArticles/siteArticleService.js'),
        ]);
        const { getPublicServiceArticles, getPublicSiteArticles } = articleApi;
        if (!alive) return;
        if (!publicSupabase) { setFailed(true); return; }
        setArticles(service
          ? await getPublicServiceArticles(publicSupabase, service, ARTICLE_LIMIT)
          : await getPublicSiteArticles(publicSupabase, ARTICLE_LIMIT));
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [service]);

  // 본문은 열릴 때마다 따로 받아온다.
  useEffect(() => {
    if (!openId) { setDetail(null); setDetailState('idle'); return undefined; }
    let alive = true;
    setDetailState('loading');
    (async () => {
      try {
        const [{ publicSupabase }, { getPublicSiteArticle }] = await Promise.all([
          import('../../shared/supabaseAnon.js'),
          import('../../shared/siteArticles/siteArticleService.js'),
        ]);
        const found = await getPublicSiteArticle(publicSupabase, openId);
        if (!alive) return;
        if (!found) throw new Error('not_found');
        setDetail(found);
        setDetailState('ready');
      } catch {
        if (alive) { setDetail(null); setDetailState('failed'); }
      }
    })();
    return () => { alive = false; };
  }, [openId]);

  useEffect(() => {
    const onPopState = (event) => setOpenId((event.state && event.state.articleId) || articleParam());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const closeArticle = useCallback(() => {
    if (window.history.state && window.history.state.articleId) window.history.back();
    else {
      window.history.replaceState({}, '', window.location.pathname);
      setOpenId(null);
    }
  }, []);

  useEffect(() => {
    if (!openId) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') closeArticle(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openId, closeArticle]);

  const openArticle = (id) => {
    window.history.pushState({ articleId: id }, '', `?article=${encodeURIComponent(id)}`);
    setOpenId(id);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const categories = [...new Set(articles.map((item) => item.category).filter(Boolean))];
  const visible = category === ALL ? articles : articles.filter((item) => (item.category || '') === category);
  const current = articles.find((item) => item.id === openId) || null;

  return (
    <>
      <section className="policy-hero news-page-hero">
        <div className="content-width">
          <span className="eyebrow eyebrow-light"><i /> {heading ? 'Service Column' : 'Insight & Trends'}</span>
          <h1>{heading || '소식/정보'}</h1>
          <p>
            {heading
              ? `${withObjectParticle(heading)} 검토할 때 자주 나오는 질문과 저희가 일하는 방식을 정리했습니다.`
              : '물류 시장의 흐름과 재경로지스｜물류의 소식을 전해드립니다.'}
          </p>
        </div>
      </section>

      <section className="news-page section">
        <div className="content-width">
          {current ? (
            <article className="news-article-view" aria-labelledby="news-article-title">
              <div className="news-article-toolbar">
                <button type="button" className="news-back-button" onClick={closeArticle} aria-label="목록으로 돌아가기">
                  <span aria-hidden="true">←</span> 뒤로가기
                </button>
                <div className="news-article-toolbar-right">
                  <button type="button" className="news-secondary-button" onClick={closeArticle}>목록 보기</button>
                  <button type="button" className="news-close-button" onClick={closeArticle} aria-label="닫기">×</button>
                </div>
              </div>
              <header className="news-article-header">
                <p className="news-article-meta">
                  {current.category && <span className="site-news-chip">{current.category}</span>}
                  <time dateTime={current.published_at}>{formatDate(current.published_at)}</time>
                  {(detail?.author || current.author) && <span className="news-article-author">{detail?.author || current.author}</span>}
                </p>
                <h2 id="news-article-title">{current.title}</h2>
                {current.summary && <p className="news-article-summary">{current.summary}</p>}
              </header>
              {/* 썸네일이 본문 맨 앞 이미지에서 자동으로 뽑힌 경우 본문에도 같은 그림이
                  있으므로, 위에 또 띄우지 않는다. */}
              {current.thumbnail_url && !(detail?.content_html ?? '').includes(current.thumbnail_url) && (
                <div className="news-article-thumb"><img src={current.thumbnail_url} alt="" /></div>
              )}
              {detailState === 'loading' && <p className="site-news-dialog-state" role="status">본문을 불러오고 있습니다.</p>}
              {detailState === 'failed' && <p className="site-news-dialog-state" role="alert">본문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
              {detailState === 'ready' && detail && (
                <PopupDocumentContent
                  html={detail.content_html}
                  className="news-article-body"
                  styleScope=".news-article-body"
                />
              )}
              <div className="news-article-footer">
                <button type="button" className="news-secondary-button" onClick={closeArticle}>목록 보기</button>
              </div>
            </article>
          ) : (
            <>
              <nav className="news-documents" aria-label="회사 자료">
                {heading && <a className="news-document-link" href="./">소식/정보 전체 보기</a>}
                {DOCUMENT_LINKS.map((item) => (
                  <a
                    key={item.href}
                    className="news-document-link"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.label} <i aria-hidden="true">↗</i>
                  </a>
                ))}
              </nav>
              {!heading && categories.length > 0 && (
                <nav className="news-categories" aria-label="분류 선택">
                  {[[ALL, '전체'], ...categories.map((name) => [name, name])].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`news-category${category === value ? ' is-active' : ''}`}
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              )}

              <ul className="news-grid">
                {!loaded && [0, 1, 2].map((key) => <li key={key}><span className="news-card news-card--skeleton" /></li>)}

                {loaded && visible.length === 0 && (
                  <li className="news-empty-row">
                    <p className="news-empty">
                      {failed ? '소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'
                        : articles.length > 0 ? '이 분류에 등록된 글이 없습니다.'
                          : heading ? `${heading} 관련 글을 준비하고 있습니다. 궁금한 점은 카카오톡 채널로 문의해 주세요.`
                            : '준비 중입니다. 곧 새로운 소식으로 찾아뵙겠습니다.'}
                    </p>
                  </li>
                )}

                {loaded && visible.map((article) => (
                  <li key={article.id}>
                    <button type="button" className="news-card" onClick={() => openArticle(article.id)}>
                      <span className="news-card-thumb">
                        {article.thumbnail_url
                          ? <img src={article.thumbnail_url} alt="" loading="lazy" decoding="async" />
                          : <span className="news-card-thumb-fallback" aria-hidden="true">JEAKYUNG</span>}
                      </span>
                      <span className="news-card-body">
                        <span className="news-card-meta">
                          {article.category && <span className="site-news-chip">{article.category}</span>}
                          <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
                          {article.author && <span className="news-card-author">{article.author}</span>}
                        </span>
                        <strong>{article.title}</strong>
                        {article.summary && <span className="news-card-summary">{article.summary}</span>}
                        <span className="news-card-more">자세히 보기 <i aria-hidden="true">→</i></span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}
