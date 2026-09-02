import { useEffect, useState } from 'react';

import { getQuickLinkAdminList, removeQuickLink, saveQuickLink } from '../../services/quickLinkService.js';

// 버튼 색과 크기는 자유 입력이 아니라 정해진 몇 가지 중에서 고른다. 색상표를
// 열어 두면 화면마다 제각각인 버튼이 쌓이고, 대비가 모자란 조합도 막을 수 없다.
const VARIANTS = [
  ['plain', '기본 (흰 바탕)'],
  ['primary', '파랑'],
  ['navy', '남색'],
  ['mint', '민트'],
  ['green', '초록'],
  ['amber', '주황'],
  ['rose', '장미'],
  ['violet', '보라'],
];
const SIZES = [['sm', '작게'], ['md', '보통'], ['lg', '크게']];

const EMPTY = { id: null, label: '', url: '', variant: 'plain', size: 'md', open_in: 'frame', sort_order: 100, is_active: true };

export default function QuickLinkAdminPanel() {
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try { setLinks(await getQuickLinkAdminList()); }
    catch (cause) { setError(cause.message || '목록을 불러오지 못했습니다.'); }
  };
  useEffect(() => { load(); }, []);

  const patch = (change) => setForm((current) => ({ ...current, ...change }));
  // 새 버튼은 목록 끝에 붙는다. 사이에 끼우려면 순서 값을 직접 고치면 된다.
  const startCreate = () => {
    const last = links.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0);
    setStatus(''); setForm({ ...EMPTY, sort_order: last + 10 });
  };
  const startEdit = (link) => { setStatus(''); setForm({ ...EMPTY, ...link }); };

  // 그룹웨어 안의 경로(/approval)는 늘 그 자리에서 이동한다 — 액자 선택이 뜻이 없다.
  const isInternal = (form?.url ?? '').trim().startsWith('/');

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setStatus('');
    try {
      await saveQuickLink(form);
      setStatus(form.id ? '수정했습니다.' : '추가했습니다.');
      setForm(null);
      await load();
    } catch (cause) {
      setError(cause.message || '저장하지 못했습니다.');
    } finally { setSaving(false); }
  };

  const remove = async (link) => {
    if (!window.confirm(`'${link.label}' 버튼을 삭제할까요?`)) return;
    setError('');
    try { await removeQuickLink(link.id); setStatus('삭제했습니다.'); await load(); }
    catch (cause) { setError(cause.message || '삭제하지 못했습니다.'); }
  };

  return (
    <section className="gw-admin-section" aria-labelledby="quicklink-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <h2 id="quicklink-admin-title">페이지 이동</h2>
          <p>홈 화면 &lsquo;페이지&rsquo; 박스에 서는 버튼입니다. 이름과 연결 주소를 직접 적고, 크기와 색을 고릅니다.</p>
        </div>
        <button type="button" className="gw-primary-button" onClick={startCreate}>버튼 추가</button>
      </div>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {status && <p className="gw-form-status" role="status">{status}</p>}

      {/* 목록 자체가 미리보기다. 고른 색과 크기가 홈 화면에서 어떻게 보이는지
          같은 클래스로 그대로 그린다. */}
      {links.length === 0 && !form && <p className="gw-empty-state">아직 등록한 버튼이 없습니다.</p>}
      {links.length > 0 && (
        <ul className="gw-quicklink-admin-list">
          {links.map((link) => (
            <li key={link.id}>
              <span className={`gw-quickbtn is-${link.variant} is-${link.size}`}>{link.label}</span>
              <span className="gw-quicklink-admin-meta">
                <code>{link.url}</code>
                <small>
                  {link.open_in === 'tab' ? '새 탭' : '화면 안'} · 순서 {link.sort_order}
                  {link.is_active ? '' : ' · 숨김'}
                </small>
              </span>
              <span className="gw-admin-actions">
                <button type="button" className="gw-secondary-button" onClick={() => startEdit(link)}>편집</button>
                <button type="button" className="gw-secondary-button gw-icon-danger-button" onClick={() => remove(link)}>삭제</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <form className="gw-inline-admin-form gw-quicklink-form" onSubmit={submit}>
          <h3>{form.id ? '버튼 수정' : '새 버튼'}</h3>
          <div className="gw-admin-form-grid">
            <label className="gw-field"><span>버튼 이름</span>
              <input value={form.label} required maxLength={40} placeholder="예: 사내메일" onChange={(event) => patch({ label: event.target.value })} />
            </label>
            <label className="gw-field"><span>연결 주소</span>
              <input value={form.url} required maxLength={500} placeholder="https://… 또는 /approval" onChange={(event) => patch({ url: event.target.value })} />
              <small className="gw-field-hint">바깥 주소는 https:// 로, 그룹웨어 안 화면은 /approval 처럼 적습니다.</small>
            </label>
            <label className="gw-field"><span>색</span>
              <select value={form.variant} onChange={(event) => patch({ variant: event.target.value })}>
                {VARIANTS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label className="gw-field"><span>크기</span>
              <select value={form.size} onChange={(event) => patch({ size: event.target.value })}>
                {SIZES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label className="gw-field"><span>여는 방법</span>
              <select value={isInternal ? 'frame' : form.open_in} disabled={isInternal} onChange={(event) => patch({ open_in: event.target.value })}>
                <option value="frame">화면 안에서 열기</option>
                <option value="tab">새 탭으로 열기</option>
              </select>
              <small className="gw-field-hint">
                {isInternal
                  ? '그룹웨어 안 화면은 늘 그 자리에서 이동합니다.'
                  : '웹메일·결제처럼 액자에 담기는 것을 막아 둔 사이트는 새 탭으로 열어야 빈 화면이 뜨지 않습니다.'}
              </small>
            </label>
            <label className="gw-field"><span>순서</span>
              <input type="number" value={form.sort_order} onChange={(event) => patch({ sort_order: Number(event.target.value) })} />
            </label>
          </div>
          <div className="gw-check-grid">
            <label><input type="checkbox" checked={form.is_active} onChange={(event) => patch({ is_active: event.target.checked })} /><span>사용 (끄면 홈 화면에서 숨김)</span></label>
          </div>
          <div className="gw-quicklink-preview">
            <span>미리보기</span>
            <span className={`gw-quickbtn is-${form.variant} is-${form.size}`}>{form.label || '버튼 이름'}</span>
          </div>
          <div className="gw-admin-actions">
            <button type="submit" className="gw-primary-button" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            <button type="button" className="gw-secondary-button" onClick={() => setForm(null)} disabled={saving}>취소</button>
          </div>
        </form>
      )}
    </section>
  );
}
