import { useEffect, useState } from 'react';

import { deleteButtonBox, getButtonBoxAdminCatalog, saveButtonBox } from '../../services/buttonBoxService.js';
import ButtonBoxGrid from '../ButtonBoxGrid.jsx';

const STYLES = [
  ['cards', '카드형 (번호 + 알약 버튼)'],
  ['tiles', '타일형 (제목만 있는 큰 상자)'],
  ['list', '목록형 (좁은 폭에 어울리는 한 줄씩)'],
];

const EMPTY_FORM = { id: null, title: '', style: 'cards', is_active: true, items: [] };
const NEW_ITEM = () => ({ key: crypto.randomUUID(), id: null, label: '', description: '', url: '' });

export default function ButtonBoxAdminPanel() {
  const [boxes, setBoxes] = useState([]);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try {
      setBoxes(await getButtonBoxAdminCatalog());
    } catch (cause) {
      setError(cause.message || '버튼 박스 목록을 불러오지 못했습니다.');
    }
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setStatus(''); setForm({ ...EMPTY_FORM, items: [NEW_ITEM()] }); };
  const startEdit = (box) => {
    setStatus('');
    setForm({
      id: box.id, title: box.title, style: box.style, is_active: box.is_active,
      items: (box.items ?? []).map((item) => ({ key: item.id, id: item.id, label: item.label, description: item.description ?? '', url: item.url })),
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
      await saveButtonBox(
        { id: form.id, title: form.title, style: form.style, is_active: form.is_active },
        form.items.filter((item) => item.label.trim() && item.url.trim())
          .map((item) => ({ label: item.label, description: item.description, url: item.url })),
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

  const remove = async (box) => {
    if (!window.confirm(`'${box.title}' 버튼 박스를 삭제할까요? 이 박스를 쓰는 링크 페이지·대시보드 위젯에서도 빈 상태로 바뀝니다.`)) return;
    setError('');
    try { await deleteButtonBox(box.id); await load(); }
    catch (cause) { setError(cause.message || '삭제하지 못했습니다.'); }
  };

  const previewItems = form?.items.filter((item) => item.label.trim() && item.url.trim())
    .map((item) => ({ id: item.key, label: item.label, description: item.description, url: item.url || '/' })) ?? [];

  return (
    <section className="gw-admin-section" aria-labelledby="buttonbox-admin-title">
      <div className="gw-admin-section-heading">
        <div>
          <h2 id="buttonbox-admin-title">버튼 박스</h2>
          <p>제목과 주소만으로 큰 버튼 묶음을 만들어, 링크 페이지나 대시보드 위젯 어디서든 골라 씁니다.</p>
        </div>
        <button type="button" className="gw-primary-button" onClick={startCreate}>새 버튼 박스</button>
      </div>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {status && <p className="gw-form-status" role="status">{status}</p>}

      {boxes.length === 0 && !form && <p className="gw-empty-state">아직 만든 버튼 박스가 없습니다.</p>}
      {boxes.length > 0 && (
        <ul className="gw-linkpage-admin-list">
          {boxes.map((box) => (
            <li key={box.id}>
              <div>
                <strong>{box.title}</strong>
                <span>{STYLES.find(([value]) => value === box.style)?.[1] ?? box.style} · 버튼 {(box.items ?? []).length}개{box.is_active ? '' : ' · 비활성'}</span>
              </div>
              <div className="gw-admin-actions">
                <button type="button" className="gw-secondary-button" onClick={() => startEdit(box)}>편집</button>
                <button type="button" className="gw-secondary-button gw-icon-danger-button" onClick={() => remove(box)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <form className="gw-linkpage-form" onSubmit={submit}>
          <div className="gw-admin-form-grid">
            <label className="gw-field"><span>박스 이름 (관리용)</span>
              <input value={form.title} required maxLength={80} onChange={(event) => patchForm({ title: event.target.value })} placeholder="예: 업무 바로가기" />
            </label>
            <label className="gw-field"><span>디자인</span>
              <select value={form.style} onChange={(event) => patchForm({ style: event.target.value })}>
                {STYLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="gw-check-grid"><label><input type="checkbox" checked={form.is_active} onChange={(event) => patchForm({ is_active: event.target.checked })} /><span>활성 (끄면 연결된 곳에서 빈 상태로 보임)</span></label></div>
          </div>

          <h3>버튼</h3>
          <p className="gw-field-hint">버튼 순서대로 배치됩니다. 주소는 <code>/boards/게시판주소</code>처럼 슬래시로 시작하면 앱 안에서 이동하고, <code>https://…</code>는 새 탭으로 엽니다.</p>
          {form.items.map((item, index) => (
            <div className="gw-linkpage-item-row gw-buttonbox-item-row" key={item.key}>
              <input value={item.label} maxLength={40} placeholder="제목" aria-label={`${index + 1}번 버튼 제목`} onChange={(event) => patchItem(item.key, { label: event.target.value })} />
              <input value={item.description} maxLength={80} placeholder="설명 (선택)" aria-label={`${index + 1}번 버튼 설명`} onChange={(event) => patchItem(item.key, { description: event.target.value })} />
              <input value={item.url} maxLength={300} placeholder="/boards/... 또는 https://..." aria-label={`${index + 1}번 버튼 주소`} onChange={(event) => patchItem(item.key, { url: event.target.value })} />
              <button type="button" className="gw-secondary-button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="위로">↑</button>
              <button type="button" className="gw-secondary-button" onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} aria-label="아래로">↓</button>
              <button type="button" className="gw-secondary-button gw-icon-danger-button" onClick={() => patchForm({ items: form.items.filter((entry) => entry.key !== item.key) })} aria-label="버튼 삭제">삭제</button>
            </div>
          ))}
          <button type="button" className="gw-secondary-button" onClick={() => patchForm({ items: [...form.items, NEW_ITEM()] })}>버튼 추가</button>

          {previewItems.length > 0 && (
            <div className="gw-buttonbox-preview">
              <h3>미리보기</h3>
              <ButtonBoxGrid box={{ style: form.style }} items={previewItems} />
            </div>
          )}

          <div className="gw-admin-actions">
            <button type="submit" className="gw-primary-button" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            <button type="button" className="gw-secondary-button" onClick={() => setForm(null)} disabled={saving}>취소</button>
          </div>
        </form>
      )}
    </section>
  );
}
