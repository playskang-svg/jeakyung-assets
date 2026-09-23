import { useEffect, useMemo, useRef, useState } from 'react';

import PopupRichEditor from '../editor/PopupRichEditor.jsx';
import PopupDocumentContent from '../../../shared/popup/PopupDocumentContent.jsx';
import { sanitizePopupHtml } from '../../../shared/popup/popupHtml.js';
import { SERVICE_NAMES } from '../../../public-site/data/services.js';
import {
  deleteSiteArticle,
  getSiteArticleAdminCatalog,
  saveSiteArticle,
  uploadSiteArticleThumbnail,
} from '../../services/siteArticleService.js';

// 공개 소식 화면이 본문을 감싸는 선택자. 글쓴이가 적은 <style> 은 이 안으로 갇힌다.
const NEWS_STYLE_SCOPE = '.news-article-body';

const SERVICE_OPTIONS = [
  ['', '소식/정보 (홈 히어로 하단 카드 및 /news/)'],
  ['3pl', '3PL 물류대행 칼럼 (/services/?service=3pl)'],
  ['fresh', '신선식품 풀필먼트 칼럼 (/services/?service=fresh)'],
  ['transport', '기업운송 칼럼 (/services/?service=transport)'],
  ['storage', '보관물류 칼럼 (/services/?service=storage)'],
  ['consulting', '물류컨설팅 칼럼 (/services/?service=consulting)'],
];

function localDateTime(value = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const createEmptyArticle = () => ({
  id: '',
  title: '',
  service_key: '',
  category: '',
  summary: '',
  author: '',
  thumbnail_url: '',
  content_mode: 'editor',
  content_html: '<p>본문을 입력하세요.</p>',
  published_at: localDateTime(),
  sort_order: 100,
  is_active: true,
  archived: false,
});

function deliveryState(article) {
  if (article.archived_at) return '보관';
  if (!article.is_active) return '중지';
  if (new Date(article.published_at).getTime() > Date.now()) return '예약';
  return '게시 중';
}

export default function SiteArticleAdminPanel() {
  const [articles, setArticles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(createEmptyArticle);
  const [filter, setFilter] = useState('all'); // 'all' | 'news' | 'service'

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bodyUploading, setBodyUploading] = useState(false);

  const bodyFileRef = useRef(null);
  const fileInputRef = useRef(null);
  const createFormRef = useRef(null);

  const load = async () => {
    setError('');
    try {
      setArticles(await getSiteArticleAdminCatalog());
    } catch (cause) {
      setError(cause.message || '소식/정보 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 최신 등록/발행 글이 가장 상단에 오도록 정렬 (보관된 글은 최하단)
  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      const aArchived = Boolean(a.archived_at);
      const bArchived = Boolean(b.archived_at);
      if (aArchived !== bArchived) return aArchived ? 1 : -1;

      const timeA = new Date(a.published_at || a.created_at).getTime() || 0;
      const timeB = new Date(b.published_at || b.created_at).getTime() || 0;
      return timeB - timeA;
    });
  }, [articles]);

  const newsCount = useMemo(() => articles.filter((a) => !a.service_key).length, [articles]);
  const serviceCount = useMemo(() => articles.filter((a) => Boolean(a.service_key)).length, [articles]);

  const filteredArticles = useMemo(() => {
    if (filter === 'news') return sortedArticles.filter((a) => !a.service_key);
    if (filter === 'service') return sortedArticles.filter((a) => Boolean(a.service_key));
    return sortedArticles;
  }, [sortedArticles, filter]);

  const patch = (values) => setForm((current) => ({ ...current, ...values }));

  const startCreate = () => {
    setStatus('');
    setError('');
    setEditingId(null);
    setIsCreating((prev) => !prev);
    setForm(createEmptyArticle());
    setTimeout(() => {
      createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const startEdit = (article) => {
    setStatus('');
    setError('');
    setIsCreating(false);
    setEditingId(article.id);
    setForm({
      ...article,
      service_key: article.service_key ?? '',
      category: article.category ?? '',
      summary: article.summary ?? '',
      author: article.author ?? '',
      thumbnail_url: article.thumbnail_url ?? '',
      published_at: localDateTime(article.published_at),
      archived: Boolean(article.archived_at),
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setIsCreating(false);
    setForm(createEmptyArticle());
  };

  const uploadThumbnail = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setStatus('');
    setUploading(true);
    try {
      patch({ thumbnail_url: await uploadSiteArticleThumbnail(file) });
      setStatus('썸네일을 올렸습니다. 저장해야 실제로 반영됩니다.');
    } catch (cause) {
      setError(`썸네일을 올리지 못했습니다. ${cause?.message ?? ''}`);
    } finally {
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadBodyImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setStatus('');
    setBodyUploading(true);
    try {
      const url = await uploadSiteArticleThumbnail(file);
      patch({
        content_mode: 'html',
        content_html: `${form.content_html}\n<p><img src="${url}" alt="" /></p>`,
      });
      setStatus('본문 끝에 이미지를 넣었습니다. HTML 편집기에서 위치를 옮길 수 있습니다.');
    } catch (cause) {
      setError(`본문 이미지를 올리지 못했습니다. ${cause?.message ?? ''}`);
    } finally {
      setBodyUploading(false);
    }
    if (bodyFileRef.current) bodyFileRef.current.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    const safeHtml = sanitizePopupHtml(form.content_html, { styleScope: NEWS_STYLE_SCOPE });
    if (!safeHtml.replace(/<[^>]*>/g, '').trim()) { setError('본문을 입력해 주세요.'); return; }
    setSaving(true); setError(''); setStatus('');
    try {
      await saveSiteArticle({
        ...form,
        service_key: form.service_key || null,
        content_html: safeHtml,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : '',
      });
      setStatus(form.id ? '수정했습니다. 공개 사이트에 바로 반영됩니다.' : '등록했습니다. 공개 사이트 메인에 바로 노출됩니다.');
      cancelForm();
      await load();
    } catch (cause) {
      setError(`저장하지 못했습니다. ${cause?.message ?? '입력값을 확인해 주세요.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (article) => {
    if (!window.confirm(`'${article.title}' 글을 삭제할까요? 공개 사이트에서 즉시 사라집니다.`)) return;
    setError(''); setStatus('');
    try {
      await deleteSiteArticle(article.id);
      if (form.id === article.id || editingId === article.id) cancelForm();
      await load();
    } catch (cause) {
      setError(cause.message || '삭제하지 못했습니다.');
    }
  };

  const renderArticleForm = (isNew = false) => (
    <form
      className="gw-linkpage-form gw-article-inline-form"
      style={{
        marginTop: isNew ? '10px' : '14px',
        marginBottom: isNew ? '16px' : '0',
        padding: '16px',
        background: 'var(--gw-surface-variant, #f8fafc)',
        borderRadius: 'var(--gw-radius, 8px)',
        border: '1px solid var(--gw-primary-border, #93c5fd)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      }}
      onSubmit={submit}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--gw-navy-950)' }}>
          {isNew ? '새 글 작성' : `글 수정 — ${form.title || '제목 없음'}`}
        </h3>
        <button
          type="button"
          className="gw-secondary-button"
          onClick={cancelForm}
          disabled={saving}
          style={{ fontSize: '13px', padding: '4px 10px' }}
        >
          닫기
        </button>
      </div>

      <div className="gw-admin-form-grid">
        <label className="gw-field gw-field--full">
          <span>제목</span>
          <input
            required
            maxLength={160}
            value={form.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="예: 2026년 3PL 물류 시장 전망"
          />
        </label>

        <label className="gw-field">
          <span>게시 위치 / 서비스 구분</span>
          <select
            value={form.service_key || ''}
            onChange={(event) => patch({ service_key: event.target.value })}
          >
            {SERVICE_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </label>

        <label className="gw-field">
          <span>분류 태그 (선택)</span>
          <input
            maxLength={40}
            value={form.category}
            onChange={(event) => patch({ category: event.target.value })}
            placeholder="예: 회사소식, 물류동향"
          />
        </label>

        <label className="gw-field">
          <span>작성자 (선택)</span>
          <input
            maxLength={60}
            value={form.author}
            onChange={(event) => patch({ author: event.target.value })}
            placeholder="예: 재경로지스｜물류 편집팀"
          />
        </label>

        <label className="gw-field">
          <span>게시 일시</span>
          <input
            required
            type="datetime-local"
            value={form.published_at}
            onChange={(event) => patch({ published_at: event.target.value })}
          />
        </label>

        <label className="gw-field">
          <span>정렬 순서</span>
          <input
            type="number"
            value={form.sort_order}
            onChange={(event) => patch({ sort_order: Number(event.target.value) })}
          />
        </label>

        <label className="gw-field gw-field--full">
          <span>요약 (카드에 3줄까지 보입니다)</span>
          <textarea
            maxLength={500}
            rows={3}
            value={form.summary}
            onChange={(event) => patch({ summary: event.target.value })}
          />
        </label>
      </div>

      <fieldset className="gw-builder-fieldset">
        <legend>썸네일</legend>
        <p className="gw-field-hint">카드 상단에 16:9로 잘려 보입니다. <strong>비워 두면 본문 맨 앞 이미지가 자동으로 썸네일이 됩니다.</strong> 본문에도 이미지가 없으면 기본 배경이 나옵니다. (JPG·PNG·WebP·GIF, 5MB 이하)</p>
        <div className="gw-article-thumb-row">
          {form.thumbnail_url
            ? <img className="gw-article-thumb-preview" src={form.thumbnail_url} alt="썸네일 미리보기" />
            : <span className="gw-article-thumb-preview is-empty" aria-hidden="true">미리보기</span>}
          <div className="gw-article-thumb-actions">
            <label className="gw-file-button">
              {uploading ? '올리는 중…' : '이미지 올리기'}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadThumbnail} disabled={uploading} />
            </label>
            {form.thumbnail_url && <button type="button" className="gw-secondary-button" onClick={() => patch({ thumbnail_url: '' })}>제거</button>}
          </div>
        </div>
        <label className="gw-field"><span>또는 이미지 주소 직접 입력</span>
          <input maxLength={1000} value={form.thumbnail_url} onChange={(event) => patch({ thumbnail_url: event.target.value })} placeholder="https://..." />
        </label>
      </fieldset>

      <fieldset className="gw-builder-fieldset">
        <legend>본문</legend>
        <div className="gw-popup-mode-switch">
          <button type="button" className={form.content_mode === 'editor' ? 'is-selected' : ''} aria-pressed={form.content_mode === 'editor'} onClick={() => patch({ content_mode: 'editor' })}>일반 편집기</button>
          <button type="button" className={form.content_mode === 'html' ? 'is-selected' : ''} aria-pressed={form.content_mode === 'html'} onClick={() => patch({ content_mode: 'html' })}>HTML 편집기</button>
          <label className="gw-file-button gw-body-image-button">
            {bodyUploading ? '올리는 중…' : '본문에 이미지 넣기'}
            <input ref={bodyFileRef} type="file" accept="image/*" disabled={bodyUploading} onChange={uploadBodyImage} />
          </label>
        </div>
        <p className="gw-field-hint">본문 이미지는 <strong>HTML 편집기</strong>에서만 유지됩니다. 일반 편집기로 바꿔 편집하면 이미지가 사라지니 주의하세요.</p>
        {form.content_mode === 'editor'
          ? <PopupRichEditor value={form.content_html} onChange={(content_html) => patch({ content_html })} />
          : <label className="gw-field gw-popup-html-field"><span>HTML 소스</span><textarea required spellCheck="false" value={form.content_html} onChange={(event) => patch({ content_html: event.target.value })} /></label>}
      </fieldset>

      <fieldset className="gw-builder-fieldset">
        <legend>미리보기</legend>
        <div className="gw-popup-preview">
          <h3>{form.title || '제목'}</h3>
          <PopupDocumentContent html={form.content_html} />
        </div>
      </fieldset>

      <div className="gw-check-grid">
        <label><input type="checkbox" checked={form.is_active} onChange={(event) => patch({ is_active: event.target.checked })} /><span>게시 활성 (끄면 공개 사이트에서 숨김)</span></label>
        {form.id && <label><input type="checkbox" checked={form.archived} onChange={(event) => patch({ archived: event.target.checked })} /><span>보관</span></label>}
      </div>

      <div className="gw-admin-actions">
        <button type="submit" className="gw-primary-button" disabled={saving || uploading || bodyUploading}>{saving ? '저장 중…' : form.id ? '변경 저장' : '등록'}</button>
        <button type="button" className="gw-secondary-button" onClick={cancelForm} disabled={saving}>수정 취소</button>
      </div>
    </form>
  );

  return (
    <section className="gw-admin-section" aria-labelledby="site-article-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <h2 id="site-article-admin-title">소식/정보 & 게시물 관리</h2>
          <p>공개 사이트 메인 히어로 하단 카드 및 각 서비스 페이지에 노출되는 글을 최신순으로 관리합니다. [편집]을 누르면 해당 글 아래에서 바로 수정할 수 있습니다.</p>
        </div>
        <button
          type="button"
          className={isCreating ? 'gw-secondary-button' : 'gw-primary-button'}
          onClick={startCreate}
        >
          {isCreating ? '작성 닫기' : '새 글 작성'}
        </button>
      </div>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {status && <p className="gw-form-status" role="status">{status}</p>}

      {/* 새 글 작성 폼: 목록 최상단에 바로 열려 스크롤이 불필요함 */}
      {isCreating && (
        <div ref={createFormRef}>
          {renderArticleForm(true)}
        </div>
      )}

      {/* 분류 필터 탭 */}
      {!loading && articles.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`gw-secondary-button ${filter === 'all' ? 'is-active' : ''}`}
            style={{ fontWeight: filter === 'all' ? '700' : 'normal', fontSize: '13px' }}
            onClick={() => setFilter('all')}
          >
            전체 ({articles.length})
          </button>
          <button
            type="button"
            className={`gw-secondary-button ${filter === 'news' ? 'is-active' : ''}`}
            style={{ fontWeight: filter === 'news' ? '700' : 'normal', fontSize: '13px' }}
            onClick={() => setFilter('news')}
          >
            소식/정보 ({newsCount})
          </button>
          <button
            type="button"
            className={`gw-secondary-button ${filter === 'service' ? 'is-active' : ''}`}
            style={{ fontWeight: filter === 'service' ? '700' : 'normal', fontSize: '13px' }}
            onClick={() => setFilter('service')}
          >
            서비스 칼럼 ({serviceCount})
          </button>
        </div>
      )}

      {loading && <p className="gw-empty-state">목록을 불러오고 있습니다.</p>}
      {!loading && filteredArticles.length === 0 && <p className="gw-empty-state">해당 분류의 글이 없습니다.</p>}

      {/* 게시물 리스트 (가장 최신 글이 맨 위) */}
      {!loading && filteredArticles.length > 0 && (
        <ul className="gw-linkpage-admin-list">
          {filteredArticles.map((article) => {
            const isEditing = editingId === article.id;
            const serviceLabel = article.service_key
              ? (SERVICE_NAMES[article.service_key] || article.service_key)
              : '소식/정보';

            return (
              <li
                key={article.id}
                className={isEditing ? 'is-editing' : ''}
                style={{
                  display: 'block',
                  borderColor: isEditing ? 'var(--gw-primary-hover, #2563eb)' : undefined,
                  background: isEditing ? 'var(--gw-surface-selected, #eff6ff)' : undefined,
                  boxShadow: isEditing ? '0 0 0 1px #2563eb' : undefined,
                  transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: article.service_key ? '#e0f2fe' : '#fef3c7',
                          color: article.service_key ? '#0369a1' : '#b45309',
                        }}
                      >
                        {serviceLabel}
                      </span>
                      <strong style={{ fontSize: '15px' }}>{article.title}</strong>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--gw-muted)' }}>
                      {deliveryState(article)}
                      {article.category ? ` · ${article.category}` : ''}
                      {` · ${new Date(article.published_at || article.created_at).toLocaleDateString('ko-KR')}`}
                      {article.thumbnail_url ? ' · 썸네일 있음' : ' · 썸네일 없음'}
                    </span>
                  </div>
                  <div className="gw-admin-actions" style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      className={isEditing ? 'gw-primary-button' : 'gw-secondary-button'}
                      onClick={() => (isEditing ? cancelForm() : startEdit(article))}
                    >
                      {isEditing ? '닫기' : '편집'}
                    </button>
                    <button
                      type="button"
                      className="gw-secondary-button gw-icon-danger-button"
                      onClick={() => remove(article)}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 해당 글 제목 바로 아래에 편집창이 열린다 */}
                {isEditing && renderArticleForm(false)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
