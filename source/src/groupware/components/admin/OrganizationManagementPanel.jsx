import { useEffect, useId, useState } from 'react';

import FormStatus from '../FormStatus.jsx';
import { upsertOrganizationItem } from '../../services/organizationService.js';

const EMPTY_ITEM = { id: '', code: '', name: '', parent_id: '', sort_order: 0, is_active: true };

function OrganizationEntityManager({ entity, title, items, departments, onSaved }) {
  const formId = useId();
  const [draft, setDraft] = useState(EMPTY_ITEM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(EMPTY_ITEM);
    setMessage('');
    setError('');
  }, [entity]);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const handleEdit = (item) => {
    setDraft({ ...EMPTY_ITEM, ...item, parent_id: item.parent_id ?? '' });
    setMessage(`${item.name} 항목을 수정 중입니다.`);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await upsertOrganizationItem({
        entity,
        id: draft.id,
        code: draft.code,
        name: draft.name,
        parentId: entity === 'department' ? draft.parent_id : null,
        sortOrder: draft.sort_order,
        isActive: draft.is_active,
      });
      const savedName = draft.name;
      setDraft(EMPTY_ITEM);
      await onSaved();
      setMessage(`${savedName} 항목을 저장했습니다.`);
    } catch {
      setError('항목을 저장하지 못했습니다. 코드 중복, 상위 부서와 관리자 권한을 확인해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="gw-organization-panel" aria-labelledby={`${formId}-title`}>
      <div className="gw-organization-heading">
        <h3 id={`${formId}-title`}>{title}</h3>
        <span>{items.length}개</span>
      </div>
      <div className="gw-organization-list" aria-label={`${title} 목록`}>
        {items.map((item) => (
          <div className="gw-organization-row" key={item.id}>
            <span className={`gw-state-dot${item.is_active ? '' : ' is-inactive'}`} aria-hidden="true" />
            <div><strong>{item.name}</strong><small>{item.code} · 순서 {item.sort_order}</small></div>
            <button className="gw-text-button" type="button" onClick={() => handleEdit(item)}>수정</button>
          </div>
        ))}
      </div>
      <form className="gw-organization-form" onSubmit={handleSubmit}>
        <div className="gw-field">
          <label htmlFor={`${formId}-code`}>코드</label>
          <input id={`${formId}-code`} value={draft.code} onChange={(event) => updateDraft('code', event.target.value)} maxLength="60" required />
        </div>
        <div className="gw-field">
          <label htmlFor={`${formId}-name`}>이름</label>
          <input id={`${formId}-name`} value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} maxLength="120" required />
        </div>
        {entity === 'department' && (
          <div className="gw-field">
            <label htmlFor={`${formId}-parent`}>상위 부서</label>
            <select id={`${formId}-parent`} value={draft.parent_id} onChange={(event) => updateDraft('parent_id', event.target.value)}>
              <option value="">없음</option>
              {departments.filter((item) => item.id !== draft.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        )}
        <div className="gw-field">
          <label htmlFor={`${formId}-sort`}>표시 순서</label>
          <input id={`${formId}-sort`} type="number" value={draft.sort_order} onChange={(event) => updateDraft('sort_order', event.target.value)} />
        </div>
        <label className="gw-check-row">
          <input type="checkbox" checked={draft.is_active} onChange={(event) => updateDraft('is_active', event.target.checked)} />
          <span>활성 상태</span>
        </label>
        <FormStatus id={`${formId}-status`} message={error || message} tone={error ? 'error' : 'info'} />
        <div className="gw-admin-actions">
          <button className="gw-primary-button" type="submit" disabled={submitting}>{submitting ? '저장 중…' : draft.id ? '변경 저장' : '새 항목 생성'}</button>
          {draft.id && <button className="gw-secondary-button" type="button" onClick={() => setDraft(EMPTY_ITEM)}>수정 취소</button>}
        </div>
      </form>
    </section>
  );
}

export default function OrganizationManagementPanel({ directory, onReload }) {
  return (
    <section className="gw-admin-section" aria-labelledby="organization-management-title">
      <div className="gw-admin-section-heading">
        <div><span className="gw-eyebrow">ORGANIZATION</span><h2 id="organization-management-title">조직 기준 관리</h2></div>
        <p>삭제 대신 비활성화하여 업무 이력과 참조 무결성을 보존합니다.</p>
      </div>
      <div className="gw-organization-grid">
        <OrganizationEntityManager entity="department" title="부서" items={directory.departments} departments={directory.departments} onSaved={onReload} />
        <OrganizationEntityManager entity="position" title="직급" items={directory.positions} departments={directory.departments} onSaved={onReload} />
        <OrganizationEntityManager entity="job_title" title="직책" items={directory.jobTitles} departments={directory.departments} onSaved={onReload} />
      </div>
    </section>
  );
}
