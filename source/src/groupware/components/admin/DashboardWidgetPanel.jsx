import { useEffect, useState } from 'react';

import { deleteOrArchiveDashboardWidget, getDashboardAdminCatalog, reorderDashboardWidgets, saveDashboardWidget } from '../../services/dashboardService.js';
import { getButtonBoxAdminCatalog } from '../../services/buttonBoxService.js';

const EMPTY = { widget_type: 'custom_notice', title: '', description: '', route: '', size: 'medium', sort_order: 100, is_required: false, allow_user_hide: true, allow_user_reorder: true, is_active: true, archived: false, configuration: {} };

export default function DashboardWidgetPanel({ directory }) {
  const [catalog, setCatalog] = useState({ widgets: [], assignments: [] });
  const [buttonBoxes, setButtonBoxes] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [target, setTarget] = useState({ target_type: 'all', target_id: '', effect: 'allow' });
  const [assignments, setAssignments] = useState([{ target_type: 'all', target_id: '', effect: 'allow' }]);
  const [status, setStatus] = useState('');
  const [moving, setMoving] = useState(false);
  const load = () => getDashboardAdminCatalog().then(setCatalog).catch(() => setStatus('위젯 관리 데이터를 불러오지 못했습니다.'));
  useEffect(() => { load(); }, []);
  useEffect(() => { getButtonBoxAdminCatalog().then((list) => setButtonBoxes((list ?? []).filter((box) => box.is_active))).catch(() => {}); }, []);

  const submit = async (event) => {
    event.preventDefault(); setStatus('저장 중…');
    try {
      if (assignments.length === 0) throw new Error('assignment_required');
      await saveDashboardWidget({ ...form, configuration: form.widget_type === 'button_box' ? { button_box_id: form.configuration?.button_box_id || null } : (form.configuration ?? {}) }, assignments.map((item) => ({ ...item, target_id: item.target_type === 'all' ? null : item.target_id })));
      setForm(EMPTY); setAssignments([{ target_type: 'all', target_id: '', effect: 'allow' }]); setStatus('위젯과 배포 규칙을 저장했습니다.'); await load();
    } catch { setStatus('위젯을 저장하지 못했습니다. 입력값과 권한을 확인해 주세요.'); }
  };

  // 대시보드에 실제로 나오는 순서대로 세운다. 같은 값이면 제목순으로 안정시킨다.
  const ordered = [...catalog.widgets].sort((a, b) => (a.sort_order - b.sort_order)
    || a.title.localeCompare(b.title, 'ko'));

  // 위/아래 버튼으로 자리를 바꾸고 곧바로 저장한다. 순서를 10 간격으로 다시 매겨
  // 나중에 사이에 끼워 넣을 여지를 남긴다.
  const move = async (index, delta) => {
    const next = [...ordered];
    const swap = index + delta;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    const orders = next.map((widget, position) => ({ id: widget.id, sort_order: (position + 1) * 10 }));
    setMoving(true); setStatus('순서를 저장하는 중…');
    try {
      await reorderDashboardWidgets(orders);
      setStatus('순서를 저장했습니다. 사용자 대시보드에 바로 반영됩니다.');
      await load();
    } catch {
      setStatus('순서를 저장하지 못했습니다. 권한을 확인해 주세요.');
    } finally {
      setMoving(false);
    }
  };

  const options = target.target_type === 'role' ? directory.roles : target.target_type === 'department' ? directory.departments : target.target_type === 'position' ? directory.positions : target.target_type === 'job_title' ? directory.jobTitles : [];
  return <section className="gw-admin-section" aria-labelledby="dashboard-admin-title"><div className="gw-admin-section-heading"><div><span className="gw-eyebrow">DASHBOARD BUILDER</span><h2 id="dashboard-admin-title">대시보드 위젯</h2></div><span className="gw-count-badge">{catalog.widgets.length}개</span></div>
    <p className="gw-field-hint">화살표로 대시보드에 나올 순서를 바로 바꿀 수 있습니다. 제목을 누르면 아래 양식에서 편집합니다.</p>
    <ol className="gw-widget-order-list">{ordered.map((widget, index) => <li key={widget.id}>
      <button type="button" className="gw-widget-order-pick" onClick={() => { setForm({ ...widget, archived: Boolean(widget.archived_at), configuration: widget.configuration ?? {} }); const selected = catalog.assignments.filter((item) => item.widget_id === widget.id).map(({ target_type, target_id, effect }) => ({ target_type, target_id: target_id ?? '', effect })); setAssignments(selected); }}>
        <strong>{widget.title}</strong><span>{widget.widget_type} · {widget.archived_at ? '보관' : widget.is_active ? '활성' : '비활성'}</span>
      </button>
      <span className="gw-widget-order-actions">
        <button type="button" className="gw-secondary-button" disabled={moving || index === 0} onClick={() => move(index, -1)} aria-label={`${widget.title} 위로`}>↑</button>
        <button type="button" className="gw-secondary-button" disabled={moving || index === ordered.length - 1} onClick={() => move(index, 1)} aria-label={`${widget.title} 아래로`}>↓</button>
      </span>
    </li>)}</ol>
    <form className="gw-builder-form" onSubmit={submit}><div className="gw-admin-form-grid">
      <label className="gw-field"><span>제목</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
      <label className="gw-field"><span>유형</span><select value={form.widget_type} onChange={(e) => setForm({ ...form, widget_type: e.target.value })}>{['notices','recent_posts','approval_status','today_schedule','week_schedule','mail_link','quick_links','emergency_alert','custom_link','custom_notice','button_box'].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="gw-field"><span>크기</span><select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>{['small','medium','large','full'].map((size) => <option key={size}>{size}</option>)}</select></label>
      <label className="gw-field"><span>순서</span><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></label>
      <label className="gw-field gw-field--full"><span>설명</span><textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <label className="gw-field gw-field--full"><span>이동 경로</span><input value={form.route ?? ''} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="/boards 또는 https://…" /></label>
      {form.widget_type === 'button_box' && <label className="gw-field gw-field--full"><span>버튼 박스</span><select value={form.configuration?.button_box_id ?? ''} onChange={(e) => setForm({ ...form, configuration: { ...form.configuration, button_box_id: e.target.value } })}><option value="">버튼 박스 선택</option>{buttonBoxes.map((box) => <option key={box.id} value={box.id}>{box.title}</option>)}</select>{buttonBoxes.length === 0 && <small className="gw-field-hint">아직 만든 버튼 박스가 없습니다. 관리자 화면의 "버튼 박스"에서 먼저 만들어 주세요.</small>}</label>}
      <label className="gw-field"><span>대상</span><select value={target.target_type} onChange={(e) => setTarget({ ...target, target_type: e.target.value, target_id: '' })}>{['all','role','department','position','job_title','user'].map((type) => <option key={type}>{type}</option>)}</select></label>
      {target.target_type !== 'all' && target.target_type !== 'user' && <label className="gw-field"><span>대상 값</span><select value={target.target_id} onChange={(e) => setTarget({ ...target, target_id: e.target.value })} required><option value="">선택</option>{options.map((item) => <option key={item.id ?? item.code} value={item.id ?? item.code}>{item.name}</option>)}</select></label>}
      {target.target_type === 'user' && <label className="gw-field"><span>사용자 UUID</span><input value={target.target_id} onChange={(e) => setTarget({ ...target, target_id: e.target.value })} required /></label>}
      <label className="gw-field"><span>효과</span><select value={target.effect} onChange={(e) => setTarget({ ...target, effect: e.target.value })}><option value="allow">allow</option><option value="deny">deny</option></select></label>
    </div><div className="gw-admin-actions"><button className="gw-secondary-button" type="button" onClick={() => { const normalized = { ...target, target_id: target.target_type === 'all' ? '' : target.target_id }; if (target.target_type !== 'all' && !target.target_id) { setStatus('배포 대상을 선택해 주세요.'); return; } setAssignments((current) => [...current, normalized]); }}>배포 규칙 추가</button></div><div className="gw-rule-list">{assignments.map((item, index) => <div key={`${item.target_type}-${item.target_id}-${item.effect}-${index}`}><code>{item.effect}</code><span>{item.target_type}{item.target_id ? `:${item.target_id}` : ''}</span><button type="button" onClick={() => setAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></div>)}</div><div className="gw-check-grid"><label><input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} /> 필수 고정</label><label><input type="checkbox" checked={form.allow_user_hide} onChange={(e) => setForm({ ...form, allow_user_hide: e.target.checked })} /> 사용자 숨김 허용</label><label><input type="checkbox" checked={form.allow_user_reorder} onChange={(e) => setForm({ ...form, allow_user_reorder: e.target.checked })} /> 순서 변경 허용</label><label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> 활성</label><label><input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} /> 보관</label></div><div className="gw-admin-actions"><button className="gw-primary-button" type="submit">위젯 저장</button>{form.id && <button className="gw-secondary-button gw-secondary-button--danger" type="button" onClick={async () => { if (!window.confirm('사용 이력이 있으면 삭제 대신 보관됩니다. 계속하시겠습니까?')) return; const result = await deleteOrArchiveDashboardWidget(form.id); setStatus(result === 'archived' ? '사용 이력이 있어 보관했습니다.' : '사용 이력이 없어 삭제했습니다.'); setForm(EMPTY); await load(); }}>안전 삭제</button>}</div>{status && <p role="status">{status}</p>}</form>
  </section>;
}
