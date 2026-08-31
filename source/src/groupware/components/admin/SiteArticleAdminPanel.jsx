import { useEffect, useRef, useState } from 'react';

import PopupRichEditor from '../editor/PopupRichEditor.jsx';
import PopupDocumentContent from '../../../shared/popup/PopupDocumentContent.jsx';
import { sanitizePopupHtml } from '../../../shared/popup/popupHtml.js';
import {
  deleteSiteArticle,
  getSiteArticleAdminCatalog,
  saveSiteArticle,
  uploadSiteArticleThumbnail,
} from '../../services/siteArticleService.js';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function localDateTime(value = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const createEmptyArticle = () => ({
  id: '', title: '', category: '', summary: '', thumbnail_url: '',
  content_mode: 'editor', content_html: '<p>본문을 입력하세요.</p>',
  published_at: localDateTime(), sort_order: 100, is_active: true, archived: false,
});

function deliveryState(article) {
  if (article.archived_at) return '보관';
  if (!article.is_active) return '중지';
  if (new Date(article.published_at).getTime() > Date.now()) return '예약';
  return '게시 중';
}

export default function SiteArticleAdminPanel() {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(createEmptyArticle);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const patch = (values) => setForm((current) => ({ ...current, ...values }));

  const startCreate = () => { setStatus(''); setError(''); setForm(createEmptyArticle()); };
  const startEdit = (article) => {
    setStatus(''); setError('');
    setForm({
      ...article,
      category: article.category ?? '',
      summary: article.summary ?? '',
      thumbnail_url: article.thumbnail_url ?? '',
      published_at: localDateTime(article.published_at),
      archived: Boolean(article.archived_at),
    });
  };

  const uploadThumbnail = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setStatus('');
    if (!THUMBNAIL_TYPES.includes(file.type)) {
      setError('썸네일은 JPG·PNG·WebP·GIF 이미지만 올릴 수 있습니다.');
    } else if (file.size > MAX_THUMBNAIL_BYTES) {
      setError('썸네일 용량은 5MB를 넘을 수 없습니다.');
    } else {
      setUploading(true);
      try {
        patch({ thumbnail_url: await uploadSiteArticleThumbnail(file) });
        setStatus('썸네일을 올렸습니다. 저장해야 실제로 반영됩니다.');
      } catch (cause) {
        setError(`썸네일을 올리지 못했습니다. ${cause?.message ?? ''}`);
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    const safeHtml = sanitizePopupHtml(form.content_html);
    if (!safeHtml.replace(/<[^>]*>/g, '').trim()) { setError('본문을 입력해 주세요.'); return; }
    setSaving(true); setError(''); setStatus('');
    try {
      await saveSiteArticle({
        ...form,
        content_html: safeHtml,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : '',
      });
      setStatus(form.id ? '수정했습니다. 공개 사이트에 바로 반영됩니다.' : '등록했습니다. 공개 사이트 메인에 바로 노출됩니다.');
      setForm(createEmptyArticle());
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
      if (form.id === article.id) setForm(createEmptyArticle());
      await load();
    } catch (cause) {
      setError(cause.message || '삭제하지 못했습니다.');
    }
  };

  return (
    <section className="gw-admin-section" aria-labelledby="site-article-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <h2 id="site-article-admin-title">소식/정보</h2>
          <p>공개 사이트 메인의 히어로 바로 아래에 카드로 노출됩니다. 방문자는 로그인 없이 읽기만 하며 댓글·작성 기능은 없습니다.</p>
        </div>
        <button type="button" className="gw-primary-button" onClick={startCreate}>새 글 작성</button>
      </div>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {status && <p className="gw-form-status" role="status">{status}</p>}

      {loading && <p className="gw-empty-state">목록을 불러오고 있습니다.</p>}
      {!loading && articles.length === 0 && <p className="gw-empty-state">아직 등록한 글이 없습니다.</p>}
      {!loading && articles.length > 0 && (
        <ul className="gw-linkpage-admin-list">
          {articles.map((article) => (
            <li key={article.id}>
              <div>
                <strong>{article.title}</strong>
                <span>
                  {deliveryState(article)}
                  {article.category ? ` · ${article.category}` : ''}
                  {` · ${new Date(article.published_at).toLocaleDateString('ko-KR')}`}
                  {article.thumbnail_url ? ' · 썸네일 있음' : ' · 썸네일 없음'}
                </span>
              </div>
              <div className="gw-admin-actions">
                <button type="button" className="gw-secondary-button" onClick={() => startEdit(article)}>편집</button>
                <button type="button" className="gw-secondary-button gw-icon-danger-button" onClick={() => remove(article)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="gw-linkpage-form" onSubmit={submit}>
        <h3>{form.id ? '글 수정' : '새 글'}</h3>
        <div className="gw-admin-form-grid">
          <label className="gw-field gw-field--full"><span>제목</span>
            <input required maxLength={160} value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="예: 2026년 3PL 물류 시장 전망" />
          </label>
          <label className="gw-field"><span>분류 (선택)</span>
            <input maxLength={40} value={form.category} onChange={(event) => patch({ category: event.target.value })} placeholder="예: 물류 동향" />
          </label>
          <label className="gw-field"><span>게시 일시</span>
            <input required type="datetime-local" value={form.published_at} onChange={(event) => patch({ published_at: event.target.value })} />
          </label>
          <label className="gw-field"><span>정렬 순서</span>
            <input type="number" value={form.sort_order} onChange={(event) => patch({ sort_order: Number(event.target.value) })} />
          </label>
          <label className="gw-field gw-field--full"><span>요약 (카드에 3줄까지 보입니다)</span>
            <textarea maxLength={500} rows={3} value={form.summary} onChange={(event) => patch({ summary: event.target.value })} />
          </label>
        </div>

        <fieldset className="gw-builder-fieldset">
          <legend>썸네일</legend>
          <p className="gw-field-hint">카드 상단에 16:9로 잘려 보입니다. 올리지 않으면 기본 배경이 나옵니다. (JPG·PNG·WebP·GIF, 5MB 이하)</p>
          <div className="gw-article-thumb-row">
            {form.thumbnail_url
              ? <img className="gw-article-thumb-preview" src={form.thumbnail_url} alt="썸네일 미리보기" />
              : <span className="gw-article-thumb-preview is-empty" aria-hidden="true">미리보기</span>}
            <div className="gw-article-thumb-actions">
              <label className="gw-file-button">
                {uploading ? '올리는 중…' : '이미지 올리기'}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadThumbnail} disabled={uploading} />
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
          </div>
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
          <button type="submit" className="gw-primary-button" disabled={saving || uploading}>{saving ? '저장 중…' : form.id ? '변경 저장' : '등록'}</button>
          {form.id && <button type="button" className="gw-secondary-button" onClick={startCreate} disabled={saving}>수정 취소</button>}
        </div>
      </form>
    </section>
  );
}
