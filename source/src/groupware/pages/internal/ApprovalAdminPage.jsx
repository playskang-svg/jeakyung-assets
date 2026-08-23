import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { approvalService } from '../../services/approvalService.js';

const EMPTY_CATEGORY = { id: '', name: '', code: '', description: '', sort_order: 100, is_active: true, archived: false };
const EMPTY_TEMPLATE = { id: '', category_id: '', name: '', code: '', description: '', document_prefix: '', is_active: true, archived: false, settings: { recall_policy: 'before_first_action', allow_self_approval: false } };
const newField = (index) => ({ id: crypto.randomUUID(), key: `field_${index + 1}`, label: '', type: 'text', required: false });
const newLine = (index) => ({ id: crypto.randomUUID(), step_order: index + 1, step_kind: 'approval', line_mode: 'sequential', required_count: 1, is_blocking: true, assignee_user_ids: [] });

export default function ApprovalAdminPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [catalog, setCatalog] = useState({ categories: [], templates: [], users: [] });
  const [tab, setTab] = useState('templates');
  const [category, setCategory] = useState(EMPTY_CATEGORY);
  const [template, setTemplate] = useState(EMPTY_TEMPLATE);
  const [fields, setFields] = useState([newField(0)]);
  const [lines, setLines] = useState([newLine(0)]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setCatalog(await approvalService.getAdminCatalog()); }
    catch (error) { setStatus(error?.message ?? '전자결재 관리 정보를 불러오지 못했습니다.'); }
  };
  useEffect(() => { load(); }, []);

  if (!['admin','super_admin'].includes(auth.activeRole)) return <Navigate to="/approval" replace />;

  const selectTemplate = (item) => {
    setTemplate({ id: item.id, category_id: item.category_id, name: item.name, code: item.code, description: item.description ?? '', document_prefix: item.document_prefix ?? '', is_active: item.is_active, archived: Boolean(item.archived_at), settings: item.settings ?? EMPTY_TEMPLATE.settings });
    setFields(Array.isArray(item.version?.form_schema) && item.version.form_schema.length > 0 ? item.version.form_schema.map((field) => ({ ...field, id: crypto.randomUUID() })) : [newField(0)]);
    setLines(Array.isArray(item.version?.line_schema) && item.version.line_schema.length > 0 ? item.version.line_schema.map((line, index) => ({ ...line, id: crypto.randomUUID(), step_order: index + 1 })) : [newLine(0)]);
  };

  const saveCategory = async (event) => {
    event.preventDefault(); setSaving(true); setStatus('');
    try { await approvalService.saveCategory(category); setCategory(EMPTY_CATEGORY); await load(); setStatus('결재 분류를 저장했습니다.'); }
    catch (error) { setStatus(error?.message ?? '결재 분류를 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    if (!template.category_id) { setStatus('양식 분류를 선택해 주세요.'); return; }
    setSaving(true); setStatus('');
    try {
      await approvalService.saveTemplate(template, fields.map(({ id, ...field }) => field), lines.map(({ id, ...line }, index) => ({ ...line, step_order: index + 1 })));
      setTemplate(EMPTY_TEMPLATE); setFields([newField(0)]); setLines([newLine(0)]); await load(); setStatus('결재 양식의 새 버전을 발행했습니다.');
    } catch (error) { setStatus(error?.message ?? '결재 양식을 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };

  return <article className="gw-approval-page" aria-labelledby="approval-admin-title">
    <header className="gw-approval-heading"><div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><button type="button" className="gw-back-icon-button" onClick={() => navigate('/approval')} aria-label="전자결재 홈으로"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button><div><span className="gw-eyebrow">APPROVAL ADMIN</span><h1 id="approval-admin-title">전자결재 관리</h1><p>분류와 양식 필드, 기본 결재선을 설정하고 새 버전을 발행합니다.</p></div></div></header>
    <div className="gw-approval-admin-tabs" role="tablist"><button type="button" className={tab === 'templates' ? 'is-active' : ''} onClick={() => setTab('templates')}>양식 관리</button><button type="button" className={tab === 'categories' ? 'is-active' : ''} onClick={() => setTab('categories')}>분류 관리</button></div>

    {tab === 'categories' ? <div className="gw-approval-admin-layout"><section className="gw-approval-card"><h2>분류 목록</h2><div className="gw-compact-list">{catalog.categories.map((item) => <button type="button" key={item.id} onClick={() => setCategory({ ...item, archived: Boolean(item.archived_at) })}><strong>{item.name}</strong><span>{item.code}{item.archived_at ? ' · 보관' : ''}</span></button>)}</div></section><form className="gw-approval-card" onSubmit={saveCategory}><h2>{category.id ? '분류 수정' : '새 분류'}</h2><div className="gw-admin-form-grid"><label className="gw-field"><span>분류명</span><input required value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} /></label><label className="gw-field"><span>분류 코드</span><input required pattern="[a-z0-9][a-z0-9_-]{1,59}" value={category.code} onChange={(event) => setCategory({ ...category, code: event.target.value.toLowerCase() })} /></label><label className="gw-field gw-field--full"><span>설명</span><textarea value={category.description ?? ''} onChange={(event) => setCategory({ ...category, description: event.target.value })} /></label></div><div className="gw-check-grid"><label><input type="checkbox" checked={category.is_active} onChange={(event) => setCategory({ ...category, is_active: event.target.checked })} /> 활성</label>{category.id && <label><input type="checkbox" checked={category.archived} onChange={(event) => setCategory({ ...category, archived: event.target.checked })} /> 보관</label>}</div><div className="gw-admin-actions"><button className="gw-primary-button" disabled={saving}>분류 저장</button>{category.id && <button className="gw-secondary-button" type="button" onClick={() => setCategory(EMPTY_CATEGORY)}>취소</button>}</div></form></div>
    : <div className="gw-approval-admin-layout"><section className="gw-approval-card"><div className="gw-approval-card-heading"><h2>발행 양식</h2><button className="gw-secondary-button" type="button" onClick={() => { setTemplate(EMPTY_TEMPLATE); setFields([newField(0)]); setLines([newLine(0)]); }}>새 양식</button></div><div className="gw-compact-list">{catalog.templates.map((item) => <button type="button" className={template.id === item.id ? 'is-selected' : ''} key={item.id} onClick={() => selectTemplate(item)}><strong>{item.name}</strong><span>{item.category_name} · v{item.version?.version_number ?? '-'}{item.archived_at ? ' · 보관' : ''}</span></button>)}</div></section><form className="gw-approval-card gw-approval-template-form" onSubmit={saveTemplate}><h2>{template.id ? '양식 새 버전 발행' : '새 양식 발행'}</h2><div className="gw-admin-form-grid"><label className="gw-field"><span>분류</span><select required value={template.category_id} onChange={(event) => setTemplate({ ...template, category_id: event.target.value })}><option value="">선택</option>{catalog.categories.filter((item) => !item.archived_at).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="gw-field"><span>양식명</span><input required value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} /></label><label className="gw-field"><span>양식 코드</span><input required pattern="[a-z0-9][a-z0-9_-]{1,59}" value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value.toLowerCase() })} /></label><label className="gw-field"><span>문서번호 접두어</span><input required pattern="[A-Z0-9-]{1,20}" value={template.document_prefix} onChange={(event) => setTemplate({ ...template, document_prefix: event.target.value.toUpperCase() })} /></label><label className="gw-field gw-field--full"><span>설명</span><textarea value={template.description ?? ''} onChange={(event) => setTemplate({ ...template, description: event.target.value })} /></label></div>
      <fieldset className="gw-builder-fieldset"><legend>입력 필드</legend><div className="gw-approval-schema-list">{fields.map((field, index) => <div key={field.id}><input aria-label={`${index + 1}번 필드 이름`} placeholder="표시 이름" value={field.label} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} /><input aria-label={`${index + 1}번 필드 코드`} placeholder="field_key" value={field.key} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') } : item))} /><select aria-label={`${index + 1}번 필드 종류`} value={field.type} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, type: event.target.value } : item))}><option value="text">한 줄</option><option value="textarea">여러 줄</option><option value="number">숫자</option><option value="date">날짜</option></select><label><input type="checkbox" checked={field.required} onChange={(event) => setFields((current) => current.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item))} /> 필수</label><button type="button" onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}>삭제</button></div>)}</div><button className="gw-secondary-button" type="button" onClick={() => setFields((current) => [...current, newField(current.length)])}>필드 추가</button></fieldset>
      <fieldset className="gw-builder-fieldset"><legend>기본 결재선</legend><div className="gw-approval-schema-list gw-approval-line-schema">{lines.map((line, index) => <div key={line.id}><span>{index + 1}단계</span><select aria-label={`${index + 1}단계 종류`} value={line.step_kind} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, step_kind: event.target.value } : item))}><option value="approval">결재</option><option value="agreement">합의</option><option value="cooperation">협조</option></select><select aria-label={`${index + 1}단계 결재자`} value={line.assignee_user_ids[0] ?? ''} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, assignee_user_ids: event.target.value ? [event.target.value] : [] } : item))}><option value="">결재자 선택</option>{catalog.users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.department_name ?? '소속 미등록'}</option>)}</select><button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>삭제</button></div>)}</div><button className="gw-secondary-button" type="button" onClick={() => setLines((current) => [...current, newLine(current.length)])}>결재 단계 추가</button></fieldset>
      <div className="gw-check-grid"><label><input type="checkbox" checked={template.is_active} onChange={(event) => setTemplate({ ...template, is_active: event.target.checked })} /> 활성</label><label><input type="checkbox" checked={template.settings.allow_self_approval} onChange={(event) => setTemplate({ ...template, settings: { ...template.settings, allow_self_approval: event.target.checked } })} /> 본인 결재 허용</label>{template.id && <label><input type="checkbox" checked={template.archived} onChange={(event) => setTemplate({ ...template, archived: event.target.checked })} /> 보관</label>}</div><button className="gw-primary-button" disabled={saving}>{saving ? '발행 중…' : '양식 버전 발행'}</button></form></div>}
    {status && <p className="gw-form-status" role="status">{status}</p>}
  </article>;
}
