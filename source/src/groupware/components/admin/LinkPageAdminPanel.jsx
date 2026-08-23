import { useEffect, useState } from 'react';

import { getBoardAdminCatalog } from '../../services/boardService.js';
import { deleteLinkPage, getLinkPageAdminCatalog, saveLinkPage } from '../../services/linkPageService.js';

const EMPTY_FORM = { id: null, title: '', slug: '', description: '', is_active: true, items: [] };
const NEW_ITEM = () => ({ key: crypto.randomUUID(), id: null, label: '', item_type: 'board', board_id: '' });

// 제목만 입력해도 쓸 수 있는 주소를 얻도록 영문·숫자만 남기고, 전부 걸러지면
// (한글 제목) 무작위 접미사로 만든다. 관리자가 직접 고칠 수 있다.
function suggestSlug(title) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || `page-${Math.random().toString(36).slice(2, 8)}`;
}

export default function LinkPageAdminPanel() {
  const [pages, setPages] = useState([]);
  const [boards, setBoards] = useState([]);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [catalog, boardCatalog] = await Promise.all([getLinkPageAdminCatalog(), getBoardAdminCatalog()]);
      setPages(catalog ?? []);
      setBoards((boardCatalog.boards ?? []).filter((board) => !board.archived_at));
    } catch (cause) {
      setError(cause.message || '링크 페이지 목록을 불러오지 못했습니다.');
    }
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setStatus(''); setForm({ ...EMPTY_FORM, items: [NEW_ITEM()] }); };
  const startEdit = (page) => {
    setStatus('');
    setForm({
      id: page.id, title: page.title, slug: page.slug, description: page.description ?? '',
      is_active: page.is_active,
      items: (page.items ?? []).map((item) => ({ key: item.id, id: item.id, label: item.label, item_type: item.item_type, board_id: item.board_id ?? '' })),
    });
  };
  const patchForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const patchItem = (key, patch) => patchForm({ items: form.items.map((item) => item.key === key ? { ...item, ...patch } : item) });
  const moveItem = (index, delta) => {
    const next = [...form.items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchForm({ items: next });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setStatus('');
    try {
      const slug = form.slug.trim() || suggestSlug(form.title);
      await saveLinkPage(
        { id: form.id, title: form.title, slug, description: form.description, is_active: form.is_active },
        form.items.filter((item) => item.label.trim() && item.board_id).map((item) => ({ label: item.label, item_type: item.item_type, board_id: item.board_id })),
      );
      setStatus('저장했습니다.');
      setForm(null);
      await load();
    } catch (cause) {
      setError(cause.message || '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (page) => {
    if (!window.confirm(`'${page.title}' 페이지를 삭제할까요? 하위 항목 연결도 함께 삭제됩니다. (연결된 게시판 자체는 남습니다)`)) return;
    setError('');
    try { await deleteLinkPage(page.id); await load(); }
    catch (cause) { setError(cause.message || '삭제하지 못했습니다.'); }
  };

  return (
    <section className="gw-admin-section" aria-labelledby="linkpage-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <h2 id="linkpage-admin-title">링크 페이지</h2>
          <p>제목 아래 고정 버튼 줄을 두고, 버튼마다 게시판을 연결하는 업무 페이지를 구성합니다.</p>
        </div>
        <button type="button" className="gw-primary-button" onClick={startCreate}>새 링크 페이지</button>
      </div>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {status && <p className="gw-form-status" role="status">{status}</p>}

      {pages.length === 0 && !form && <p className="gw-empty-state">아직 만든 링크 페이지가 없습니다.</p>}
      {pages.length > 0 && (
        <ul className="gw-linkpage-admin-list">
          {pages.map((page) => (
            <li key={page.id}>
              <div>
                <strong>{page.title}</strong>
                <span>/pages/{page.slug} · 항목 {(page.items ?? []).length}개{page.is_active ? '' : ' · 비활성'}</span>
              </div>
              <div className="gw-admin-actions">
                <button type="button" className="gw-secondary-button" onClick={() => startEdit(page)}>편집</button>
                <button type="button" className="gw-secondary-button gw-icon-danger-button" onClick={() => remove(page)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <form className="gw-linkpage-form" onSubmit={submit}>
          <div className="gw-admin-form-grid">
            <label className="gw-field"><span>페이지 제목</span>
              <input value={form.title} required maxLength={80} onChange={(event) => patchForm({ title: event.target.value })} placeholder="예: 지입업무 관리" />
            </label>
            <label className="gw-field"><span>주소 (영문·숫자·하이픈)</span>
              <input value={form.slug} pattern="[a-z0-9][a-z0-9-]{1,62}" onChange={(event) => patchForm({ slug: event.target.value })} placeholder={suggestSlug(form.title || 'page')} />
            </label>
            <label className="gw-field"><span>설명 (선택)</span>
              <input value={form.description} maxLength={200} onChange={(event) => patchForm({ description: event.target.value })} />
            </label>
            <div className="gw-check-grid"><label><input type="checkbox" checked={form.is_active} onChange={(event) => patchForm({ is_active: event.target.checked })} /><span>활성 (끄면 목록·주소에서 숨김)</span></label></div>
          </div>

          <h3>하위 페이지 버튼</h3>
          <p className="gw-field-hint">버튼 순서대로 머리글에 나열됩니다. 지금은 게시판만 연결할 수 있습니다.</p>
          {form.items.map((item, index) => (
            <div className="gw-linkpage-item-row" key={item.key}>
              <input value={item.label} maxLength={40} placeholder="버튼 이름" aria-label={`${index + 1}번 버튼 이름`} onChange={(event) => patchItem(item.key, { label: event.target.value })} />
              <select value={item.board_id} aria-label={`${index + 1}번 버튼에 연결할 게시판`} onChange={(event) => patchItem(item.key, { board_id: event.target.value })}>
                <option value="">게시판 선택</option>
                {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
              </select>
              <button type="button" className="gw-secondary-button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="위로">↑</button>
              <button type="button" className="gw-secondary-button" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} aria-label="아래로">↓</button>
              <button type="button" className="gw-secondary-button gw-icon-danger-button" onClick={() => patchForm({ items: form.items.filter((entry) => entry.key !== item.key) })} aria-label="항목 삭제">삭제</button>
            </div>
          ))}
          <button type="button" className="gw-secondary-button" onClick={() => patchForm({ items: [...form.items, NEW_ITEM()] })}>항목 추가</button>

          <div className="gw-admin-actions">
            <button type="submit" className="gw-primary-button" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            <button type="button" className="gw-secondary-button" onClick={() => setForm(null)} disabled={saving}>취소</button>
          </div>
        </form>
      )}
    </section>
  );
}
