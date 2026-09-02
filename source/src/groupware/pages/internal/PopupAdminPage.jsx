import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PopupRichEditor from '../../components/editor/PopupRichEditor.jsx';
import { loadPopupAdminCatalog, managePopupDocument, removePopupDocument } from '../../services/popupService.js';
import PopupDocumentContent from '../../../shared/popup/PopupDocumentContent.jsx';
import { sanitizePopupHtml } from '../../../shared/popup/popupHtml.js';

// 공개 사이트 타깃은 DB(popup_documents_targets 제약)와 익명 조회 권한이 이미
// 갖춰져 있었는데 관리자 화면에서만 고를 수 없었다.
const TARGETS = [
  ['groupware_all', '그룹웨어 전체 · 로그인 후'],
  ['groupware_dashboard', '그룹웨어 · 대시보드'],
  ['groupware_boards', '그룹웨어 · 게시판'],
  ['groupware_approval', '그룹웨어 · 전자결재'],
  ['groupware_admin', '그룹웨어 · 관리자'],
  ['public_all', '공개 사이트 전체 · 로그인 없이'],
  ['public_home', '공개 사이트 · 홈'],
  ['public_privacy', '공개 사이트 · 개인정보처리방침'],
];

function localDateTime(value = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const SIZES = [
  ['small', '작게 · 480px'],
  ['medium', '보통 · 720px'],
  ['large', '크게 · 960px'],
  ['full', '넓게 · 화면의 90%'],
];

const createEmptyDocument = () => ({
  id: '', title: '', content_mode: 'editor', content_html: '<p>팝업 내용을 입력하세요.</p>',
  targets: ['groupware_all'], size: 'medium', starts_at: localDateTime(), ends_at: '', sort_order: 100,
  is_active: true, archived: false,
});

function deliveryState(documentValue) {
  if (documentValue.archived_at) return '보관';
  if (!documentValue.is_active) return '중지';
  const now = Date.now();
  if (new Date(documentValue.starts_at).getTime() > now) return '예약';
  if (documentValue.ends_at && new Date(documentValue.ends_at).getTime() <= now) return '종료';
  return '게시 중';
}

export default function PopupAdminPage() {
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(createEmptyDocument);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const catalog = await loadPopupAdminCatalog();
      setDocuments(catalog.documents ?? []);
    } catch {
      setStatus('팝업 문서 목록을 불러오지 못했습니다. 관리자 권한과 데이터베이스 적용 상태를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const targetLabels = useMemo(() => Object.fromEntries(TARGETS), []);
  // 팝업 삭제는 되돌릴 수 없다. '보관'과 헷갈리지 않도록 무엇이 사라지는지
  // 제목까지 넣어 한 번 되묻는다.
  const removeDocument = async () => {
    if (!form.id) return;
    if (!window.confirm(`'${form.title}' 팝업을 삭제할까요? 되돌릴 수 없습니다. 잠시 내리려는 것이라면 '게시 중지'를 쓰세요.`)) return;
    setSaving(true);
    try {
      await removePopupDocument(form.id);
      setForm(createEmptyDocument());
      setStatus('삭제했습니다.');
      await load();
    } catch (cause) {
      setStatus(cause.message || '삭제하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const selectDocument = (item) => setForm({
    ...item,
    size: item.size ?? 'medium',
    starts_at: localDateTime(item.starts_at),
    ends_at: localDateTime(item.ends_at),
    archived: Boolean(item.archived_at),
  });

  const toggleTarget = (target, checked) => setForm((current) => ({
    ...current,
    targets: checked ? [...new Set([...current.targets, target])] : current.targets.filter((item) => item !== target),
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (form.targets.length === 0) { setStatus('노출 위치를 한 곳 이상 선택해 주세요.'); return; }
    const safeHtml = sanitizePopupHtml(form.content_html);
    if (!safeHtml.replace(/<[^>]*>/g, '').trim()) { setStatus('팝업 내용을 입력해 주세요.'); return; }
    setSaving(true);
    setStatus('');
    try {
      await managePopupDocument({
        ...form,
        content_html: safeHtml,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : '',
      });
      setStatus(form.id ? '팝업 문서를 수정했습니다.' : '팝업 문서를 만들었습니다. 게시 기간과 위치에 맞춰 자동 노출됩니다.');
      setForm(createEmptyDocument());
      await load();
    } catch (error) {
      setStatus(`팝업 문서를 저장하지 못했습니다. ${error?.message ?? '입력값을 확인해 주세요.'}`);
    } finally {
      setSaving(false);
    }
  };

  return <article className="gw-page gw-admin-page" aria-labelledby="page-title">
    <header className="gw-page-header"><div><span className="gw-eyebrow">POPUP DOCUMENTS</span><h1 id="page-title">팝업 문서 관리</h1><p>HTML 또는 일반 편집기로 그룹웨어 안내 문서를 작성하고 노출 화면과 게시 기간을 지정합니다.</p></div><div className="gw-admin-actions"><Link className="gw-secondary-button" to="/admin">전체 관리자 화면</Link><button className="gw-primary-button" type="button" onClick={() => setForm(createEmptyDocument())}>새 팝업 만들기</button></div></header>

    <section className="gw-admin-section"><div className="gw-admin-section-heading"><div><h2>팝업 목록</h2><p>게시 중·예약·종료·중지 상태를 확인하고 수정할 문서를 선택하세요.</p></div><span className="gw-count-badge">{documents.length}개</span></div>{loading ? <p className="gw-empty-state">목록을 불러오고 있습니다.</p> : <div className="gw-popup-admin-list">{documents.map((item) => <button type="button" key={item.id} className={form.id === item.id ? 'is-selected' : ''} onClick={() => selectDocument(item)}><span className={`gw-popup-state is-${deliveryState(item).replace(' ', '-')}`}>{deliveryState(item)}</span><strong>{item.title}</strong><small>{item.targets.map((target) => targetLabels[target] ?? target).join(' · ')}</small><time>{new Date(item.starts_at).toLocaleString('ko-KR')} ~ {item.ends_at ? new Date(item.ends_at).toLocaleString('ko-KR') : '종료일 없음'}</time></button>)}</div>}</section>

    <form className="gw-admin-section gw-popup-admin-form" onSubmit={submit}>
      <div className="gw-admin-section-heading"><div><h2>{form.id ? '팝업 문서 수정' : '새 팝업 문서'}</h2><p>일반 편집기는 서식 도구를 제공하고 HTML 편집기는 안전한 HTML 태그만 저장합니다.</p></div></div>
      <div className="gw-admin-form-grid"><label className="gw-field gw-field--full"><span>팝업 제목</span><input required maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="gw-field"><span>게시 시작</span><input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label><label className="gw-field"><span>게시 종료(선택)</span><input type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label><label className="gw-field"><span>정렬 순서</span><input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></label><label className="gw-field"><span>팝업 크기</span><select value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })}>{SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>

      <fieldset className="gw-builder-fieldset"><legend>노출 위치</legend><div className="gw-popup-target-grid">{TARGETS.map(([value, label]) => <label key={value}><input type="checkbox" checked={form.targets.includes(value)} onChange={(event) => toggleTarget(value, event.target.checked)} /><span>{label}</span></label>)}</div></fieldset>

      <fieldset className="gw-builder-fieldset"><legend>문서 작성 방식</legend><div className="gw-popup-mode-switch"><button type="button" className={form.content_mode === 'editor' ? 'is-selected' : ''} aria-pressed={form.content_mode === 'editor'} onClick={() => setForm({ ...form, content_mode: 'editor' })}>일반 편집기</button><button type="button" className={form.content_mode === 'html' ? 'is-selected' : ''} aria-pressed={form.content_mode === 'html'} onClick={() => setForm({ ...form, content_mode: 'html' })}>HTML 편집기</button></div>{form.content_mode === 'editor' ? <PopupRichEditor value={form.content_html} onChange={(content_html) => setForm((current) => ({ ...current, content_html }))} /> : <label className="gw-field gw-popup-html-field"><span>HTML 소스</span><textarea required spellCheck="false" value={form.content_html} onChange={(event) => setForm({ ...form, content_html: event.target.value })} /></label>}</fieldset>

      <fieldset className="gw-builder-fieldset"><legend>미리보기</legend><div className="gw-popup-preview"><h3>{form.title || '팝업 제목'}</h3><PopupDocumentContent html={form.content_html} /></div></fieldset>
      <div className="gw-check-grid"><label><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> 게시 활성</label>{form.id && <label><input type="checkbox" checked={form.archived} onChange={(event) => setForm({ ...form, archived: event.target.checked })} /> 보관</label>}</div>
      <div className="gw-admin-actions"><button className="gw-primary-button" type="submit" disabled={saving}>{saving ? '저장 중…' : form.id ? '변경 저장' : '팝업 문서 생성'}</button>{form.id && <button className="gw-secondary-button" type="button" onClick={() => setForm(createEmptyDocument())}>수정 취소</button>}{form.id && <button className="gw-secondary-button gw-secondary-button--danger" type="button" disabled={saving} onClick={removeDocument}>삭제</button>}</div>
      {status && <p className="gw-form-status" role="status">{status}</p>}
    </form>
  </article>;
}
