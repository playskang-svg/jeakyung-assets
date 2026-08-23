import { useEffect, useState } from 'react';

import { deleteOrArchiveDashboardWidget, getDashboardAdminCatalog, saveDashboardWidget } from '../../services/dashboardService.js';

const EMPTY = { widget_type: 'custom_notice', title: '', description: '', route: '', size: 'medium', sort_order: 100, is_required: false, allow_user_hide: true, allow_user_reorder: true, is_active: true, archived: false };

export default function DashboardWidgetPanel({ directory }) {
  const [catalog, setCatalog] = useState({ widgets: [], assignments: [] });
  const [form, setForm] = useState(EMPTY);
  const [target, setTarget] = useState({ target_type: 'all', target_id: '', effect: 'allow' });
  const [assignments, setAssignments] = useState([{ target_type: 'all', target_id: '', effect: 'allow' }]);
  const [status, setStatus] = useState('');
  const load = () => getDashboardAdminCatalog().then(setCatalog).catch(() => setStatus('위젯 관리 데이터를 불러오지 못했습니다.'));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setStatus('저장 중…');
    try {
      if (assignments.length === 0) throw new Error('assignment_required');
      await saveDashboardWidget(form, assignments.map((item) => ({ ...item, target_id: item.target_type === 'all' ? null : item.target_id })));
      setForm(EMPTY); setAssignments([{ target_type: 'all', target_id: '', effect: 'allow' }]); setStatus('위젯과 배포 규칙을 저장했습니다.'); await load();
    } catch { setStatus('위젯을 저장하지 못했습니다. 입력값과 권한을 확인해 주세요.'); }
  };

  const options = target.target_type === 'role' ? directory.roles : target.target_type === 'department' ? directory.departments : target.target_type === 'position' ? directory.positions : target.target_type === 'job_title' ? directory.jobTitles : [];
  return <section className="gw-admin-section" aria-labelledby="dashboard-admin-title"><div className="gw-admin-section-heading"><div><span className="gw-eyebrow">DASHBOARD BUILDER</span><h2 id="dashboard-admin-title">대시보드 위젯</h2></div><span className="gw-count-badge">{catalog.widgets.length}개</span></div>
    <div className="gw-compact-list">{catalog.widgets.map((widget) => <button type="button" key={widget.id} onClick={() => { setForm({ ...widget, archived: Boolean(widget.archived_at) }); const selected = catalog.assignments.filter((item) => item.widget_id === widget.id).map(({ target_type, target_id, effect }) => ({ target_type, target_id: target_id ?? '', effect })); setAssignments(selected); }}><strong>{widget.title}</strong><span>{widget.widget_type} · {widget.archived_at ? '보관' : widget.is_active ? '활성' : '비활성'}</span></button>)}</div>
    <form className="gw-builder-form" onSubmit={submit}><div className="gw-admin-form-grid">
      <label className="gw-field"><span>제목</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
      <label className="gw-field"><span>유형</span><select value={form.widget_type} onChange={(e) => setForm({ ...form, widget_type: e.target.value })}>{['notices','recent_posts','approval_status','today_schedule','week_schedule','mail_link','quick_links','emergency_alert','custom_link','custom_notice'].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="gw-field"><span>크기</span><select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>{['small','medium','large','full'].map((size) => <option key={size}>{size}</option>)}</select></label>
      <label className="gw-field"><span>순서</span><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></label>
      <label className="gw-field gw-field--full"><span>설명</span><textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <label className="gw-field gw-field--full"><span>이동 경로</span><input value={form.route ?? ''} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="/boards 또는 https://…" /></label>
      <label className="gw-field"><span>대상</span><select value={target.target_type} onChange={(e) => setTarget({ ...target, target_type: e.target.value, target_id: '' })}>{['all','role','department','position','job_title','user'].map((type) => <option key={type}>{type}</option>)}</select></label>
      {target.target_type !== 'all' && target.target_type !== 'user' && <label className="gw-field"><span>대상 값</span><select value={target.target_id} onChange={(e) => setTarget({ ...target, target_id: e.target.value })} required><option value="">선택</option>{options.map((item) => <option key={item.id ?? item.code} value={item.id ?? item.code}>{item.name}</option>)}</select></label>}
      {target.target_type === 'user' && <label className="gw-field"><span>사용자 UUID</span><input value={target.target_id} onChange={(e) => setTarget({ ...target, target_id: e.target.value })} required /></label>}
      <label className="gw-field"><span>효과</span><select value={target.effect} onChange={(e) => setTarget({ ...target, effect: e.target.value })}><option value="allow">allow</option><option value="deny">deny</option></select></label>
    </div><div className="gw-admin-actions"><button className="gw-secondary-button" type="button" onClick={() => { const normalized = { ...target, target_id: target.target_type === 'all' ? '' : target.target_id }; if (target.target_type !== 'all' && !target.target_id) { setStatus('배포 대상을 선택해 주세요.'); return; } setAssignments((current) => [...current, normalized]); }}>배포 규칙 추가</button></div><div className="gw-rule-list">{assignments.map((item, index) => <div key={`${item.target_type}-${item.target_id}-${item.effect}-${index}`}><code>{item.effect}</code><span>{item.target_type}{item.target_id ? `:${item.target_id}` : ''}</span><button type="button" onClick={() => setAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></div>)}</div><div className="gw-check-grid"><label><input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} /> 필수 고정</label><label><input type="checkbox" checked={form.allow_user_hide} onChange={(e) => setForm({ ...form, allow_user_hide: e.target.checked })} /> 사용자 숨김 허용</label><label><input type="checkbox" checked={form.allow_user_reorder} onChange={(e) => setForm({ ...form, allow_user_reorder: e.target.checked })} /> 순서 변경 허용</label><label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> 활성</label><label><input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} /> 보관</label></div><div className="gw-admin-actions"><button className="gw-primary-button" type="submit">위젯 저장</button>{form.id && <button className="gw-secondary-button gw-secondary-button--danger" type="button" onClick={async () => { if (!window.confirm('사용 이력이 있으면 삭제 대신 보관됩니다. 계속하시겠습니까?')) return; const result = await deleteOrArchiveDashboardWidget(form.id); setStatus(result === 'archived' ? '사용 이력이 있어 보관했습니다.' : '사용 이력이 없어 삭제했습니다.'); setForm(EMPTY); await load(); }}>안전 삭제</button>}</div>{status && <p role="status">{status}</p>}</form>
  </section>;
}
