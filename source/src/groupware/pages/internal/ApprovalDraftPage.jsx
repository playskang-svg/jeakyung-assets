import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { approvalService } from '../../services/approvalService.js';
import { useAuth } from '../../context/AuthContext.jsx';

function bodyToText(bodyJson) {
  return (bodyJson?.content ?? []).flatMap((node) => node.content ?? []).map((node) => node.text ?? '').join('\n');
}

function textToBody(value) {
  return { type: 'doc', content: String(value || '').split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) };
}

export default function ApprovalDraftPage({ isEdit = false }) {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [catalog, setCatalog] = useState({ templates: [], users: [] });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formData, setFormData] = useState({});
  const [customLines, setCustomLines] = useState(null);
  const [approverSearch, setApproverSearch] = useState('');
  const [references, setReferences] = useState([]);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const nextCatalog = await approvalService.getAuthoringCatalog();
        if (!active) return;
        setCatalog(nextCatalog);
        if (isEdit && documentId) {
          const documentValue = await approvalService.getDocument(documentId);
          if (!active) return;
          setSelectedTemplateId(documentValue.template_id);
          setTitle(documentValue.title ?? '');
          setBody(bodyToText(documentValue.revision?.body_json));
          setFormData(documentValue.revision?.form_data ?? {});
          setExistingAttachments(documentValue.attachments ?? []);

          // 결재선 복원: revision lines → draft_line_schema 순으로 폴백
          let loadedCustomLines = null;
          if (documentValue.lines && documentValue.lines.length > 0) {
            const revisionLines = documentValue.lines
              .filter((line) => line.revision_id === documentValue.current_revision_id)
              .sort((a, b) => a.step_order - b.step_order);
            if (revisionLines.length > 0) {
              loadedCustomLines = revisionLines.map((line, index) => ({
                step_order: index + 1,
                step_kind: line.step_kind,
                line_mode: line.line_mode,
                required_count: line.required_count,
                is_blocking: line.is_blocking,
                assignee_user_ids: (line.assignees ?? []).map((item) => item.assigned_user_id),
              }));
            }
          }
          if (!loadedCustomLines && Array.isArray(documentValue.draft_line_schema) && documentValue.draft_line_schema.length > 0) {
            loadedCustomLines = documentValue.draft_line_schema.map((line, index) => ({
              step_order: index + 1,
              step_kind: line.step_kind ?? 'approval',
              line_mode: line.line_mode ?? 'sequential',
              required_count: line.required_count ?? 1,
              is_blocking: line.is_blocking ?? true,
              assignee_user_ids: (line.assignees ?? []).flatMap((item) => (item.user_id ? [item.user_id] : [])),
            }));
          }
          setCustomLines(loadedCustomLines);
          setReferences((documentValue.references ?? []).map((item) => ({ user_id: item.user_id, reference_type: item.reference_type })));
        } else {
          setSelectedTemplateId(nextCatalog.templates[0]?.id ?? '');
        }
      } catch (error) {
        if (active) setStatus(error?.message ?? '기안 작성 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [documentId, isEdit]);

  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('jeakyung-approval-presets') || '[]');
    } catch {
      return [];
    }
  });

  const selectedTemplate = catalog.templates.find((item) => item.id === selectedTemplateId) ?? null;
  const fields = Array.isArray(selectedTemplate?.version?.form_schema) ? selectedTemplate.version.form_schema : [];
  const lines = Array.isArray(selectedTemplate?.version?.line_schema) ? selectedTemplate.version.line_schema : [];
  const userNames = useMemo(() => Object.fromEntries(catalog.users.map((item) => [item.id, item.name])), [catalog.users]);

  // 주요 결재자 (대표이사, 사장, 이사, 지사장, 본부장, 팀장 등 사원/대리가 아닌 직원)
  const executiveUsers = useMemo(() => {
    const selected = new Set((customLines ?? []).flatMap((line) => line.assignee_user_ids ?? []));
    const ranks = ['대표', '사장', '임원', '이사', '전무', '상무', '지사장', '본부장', '센터장', '팀장', '부장', '차장', '과장', '관리자'];
    const candidates = catalog.users.filter((u) => {
      if (u.id === auth.user?.id || selected.has(u.id)) return false;
      const pos = `${u.position_name ?? ''} ${u.job_title_name ?? ''} ${u.department_name ?? ''} ${u.name ?? ''}`;
      return ranks.some((r) => pos.includes(r)) || (!pos.includes('사원') && !pos.includes('대리'));
    });
    return candidates.length > 0 ? candidates : catalog.users.filter((u) => u.id !== auth.user?.id && !selected.has(u.id));
  }, [catalog.users, customLines, auth.user?.id]);

  const saveCurrentPreset = () => {
    if (!customLines || customLines.length === 0) {
      alert('저장할 결재선이 없습니다. 먼저 결재자를 추가해 주세요.');
      return;
    }
    const name = window.prompt('저장할 결재선 이름을 입력하세요. (예: 팀장-이사-대표이사 결재선)');
    if (!name || !name.trim()) return;
    const newPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      lines: customLines.map((l) => ({ assignee_user_ids: l.assignee_user_ids })),
    };
    const next = [newPreset, ...savedPresets.filter((p) => p.name !== name.trim())].slice(0, 15);
    setSavedPresets(next);
    try { localStorage.setItem('jeakyung-approval-presets', JSON.stringify(next)); } catch {}
  };

  const applyPreset = (preset) => {
    if (!preset || !preset.lines) return;
    setCustomLines(
      preset.lines.map((l, index) => ({
        step_order: index + 1,
        step_kind: 'approval',
        line_mode: 'sequential',
        required_count: 1,
        is_blocking: true,
        assignee_user_ids: l.assignee_user_ids ?? [],
      }))
    );
  };

  const approverResults = useMemo(() => {
    const term = approverSearch.trim().toLowerCase();
    if (term.length < 1) return [];
    const selected = new Set((customLines ?? []).flatMap((line) => line.assignee_user_ids ?? []));
    return catalog.users
      .filter((user) => user.id !== auth.user?.id && !selected.has(user.id) && `${user.name} ${user.department_name ?? ''} ${user.position_name ?? ''}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [approverSearch, catalog.users, customLines, auth.user?.id]);

  const referenceResults = useMemo(() => {
    const term = referenceSearch.trim().toLowerCase();
    if (!term) return [];
    const selected = new Set(references.map((item) => item.user_id));
    return catalog.users
      .filter((user) => user.id !== auth.user?.id && !selected.has(user.id) && `${user.name} ${user.department_name ?? ''} ${user.position_name ?? ''}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [referenceSearch, references, catalog.users, auth.user?.id]);

  const save = async ({ submit = false } = {}) => {
    if (!selectedTemplate) { setStatus('사용 가능한 결재 양식이 없습니다.'); return; }
    if (!title.trim()) { setStatus('제목을 입력해 주세요.'); return; }
    const missingField = fields.find((field) => field.required && !String(formData[field.key] ?? '').trim());
    if (missingField) { setStatus(`${missingField.label} 항목을 입력해 주세요.`); return; }
    if (customLines !== null && customLines.length === 0) { setStatus('결재자를 한 명 이상 지정해 주세요.'); return; }
    setSubmitting(true);
    setStatus('');
    try {
      // 1. 기안 저장
      const savedId = await approvalService.saveDraft({
        documentId: isEdit ? documentId : null,
        templateId: selectedTemplate.id,
        title: title.trim(),
        bodyJson: textToBody(body),
        formData,
        lineSchemaOverride: customLines,
      });

      // 2. 참조자 설정
      await approvalService.setReferences(savedId, references);

      // 3. 첨부파일 업로드 (개별 실패를 모아서 나중에 알림, 기안 제출 자체는 계속)
      const uploadErrors = [];
      const successFiles = [];
      for (const file of attachmentFiles) {
        try {
          await approvalService.uploadAttachment(savedId, file);
          successFiles.push(file);
        } catch (uploadError) {
          uploadErrors.push(`${file.name}: ${uploadError?.message ?? '업로드 실패'}`);
        }
      }
      setAttachmentFiles([]);

      if (customLines && customLines.length > 0) {
        try {
          const recent = {
            id: 'recent-last',
            name: `최근 사용 결재선 (${customLines.length}명)`,
            lines: customLines.map((l) => ({ assignee_user_ids: l.assignee_user_ids })),
          };
          localStorage.setItem('jeakyung-approval-recent', JSON.stringify(recent));
        } catch {}
      }

      if (submit) {
        // 4. 기안 제출
        await approvalService.submitDocument(savedId);
        if (uploadErrors.length > 0) {
          // 첨부파일 일부 실패했지만 기안은 제출됨
          alert(`기안이 제출되었습니다.\n\n다음 첨부파일은 등록에 실패했습니다:\n${uploadErrors.join('\n')}`);
        }
        navigate('/approval/outbox');
      } else {
        const freshDoc = await approvalService.getDocument(savedId);
        setExistingAttachments(freshDoc.attachments ?? []);
        if (!isEdit) {
          navigate(`/approval/documents/${savedId}/edit`, { replace: true });
        } else if (uploadErrors.length > 0) {
          setStatus(`임시 저장했습니다. 단, 일부 파일 첨부에 실패했습니다:\n${uploadErrors.join(' / ')}`);
        } else {
          setStatus('임시 저장했습니다.');
        }
      }
    } catch (error) {
      setStatus(formatApprovalError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="gw-empty-state" role="status">기안 작성 화면을 불러오고 있습니다.</p>;
  if (!loading && catalog.templates.length === 0) return <div className="gw-notice gw-notice--warning">게시된 결재 양식이 없습니다. 관리자에게 양식 발행을 요청해 주세요.</div>;

  return (
    <article className="gw-approval-page" aria-labelledby="approval-draft-title">
      <header className="gw-approval-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button type="button" className="gw-back-icon-button" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <span className="gw-eyebrow">APPROVAL DRAFT</span>
            <h1 id="approval-draft-title">{isEdit ? '기안서 수정' : '새 기안 작성'}</h1>
            <p>양식에 맞춰 내용을 작성한 후 아래에서 결재선을 지정해 주세요.</p>
          </div>
        </div>
        <div className="gw-admin-actions">
          <button className="gw-secondary-button" type="button" onClick={() => navigate('/approval/outbox')}>목록 보기</button>
          <button className="gw-secondary-button" type="button" disabled={submitting} onClick={() => save()}>임시 저장</button>
          <button className="gw-primary-button" type="button" disabled={submitting} onClick={() => save({ submit: true })}>{submitting ? '처리 중…' : '기안 요청'}</button>
        </div>
      </header>

      {/* 양식·제목 */}
      <section className="gw-approval-card">
        <div className="gw-admin-form-grid">
          <label className="gw-field">
            <span>결재 양식</span>
            <select value={selectedTemplateId} disabled={isEdit} onChange={(event) => { setSelectedTemplateId(event.target.value); setFormData({}); setCustomLines(null); }}>
              {catalog.templates.map((item) => <option key={item.id} value={item.id}>{item.category_name} · {item.name}</option>)}
            </select>
          </label>
          <label className="gw-field gw-field--full">
            <span>제목</span>
            <input maxLength="240" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="기안서 제목" />
          </label>
        </div>
      </section>

      {/* 양식 입력 */}
      <section className="gw-approval-card">
        <h2>양식 입력</h2>
        <div className="gw-approval-form-grid">
          {fields.map((field) => (
            <ApprovalField key={field.key} field={field} value={formData[field.key] ?? ''} onChange={(value) => setFormData((cur) => ({ ...cur, [field.key]: value }))} />
          ))}
        </div>
        <label className="gw-field">
          <span>상세 내용</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="기안 배경, 요청 사항과 참고 내용을 작성하세요." />
        </label>
      </section>

      {/* 결재선 */}
      <section className="gw-approval-card">
        <div className="gw-approval-card-heading">
          <div>
            <h2>결재선 지정</h2>
            <p>등록된 직원을 콤보박스 목록에서 바로 선택하거나 추천 결재자(대표이사/이사/지사장/팀장 등)를 클릭하여 지정할 수 있습니다.</p>
          </div>
          <button className="gw-secondary-button" type="button" onClick={() => { setCustomLines((cur) => cur === null ? [] : null); setApproverSearch(''); }}>
            {customLines === null ? '직접 지정' : '양식 기본값 사용'}
          </button>
        </div>

        {customLines === null ? (
          <div className="gw-approval-line-preview">
            {lines.map((line, index) => (
              <div key={`${line.step_order}-${index}`}>
                <span>{line.step_order ?? index + 1}</span>
                <div>
                  <strong>{stepKindLabel(line.step_kind)}</strong>
                  <p>{lineTargetLabel(line, userNames)} · {lineModeLabel(line)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 주요 결재자 (대표이사, 사장, 이사, 지사장, 본부장, 팀장 등) 빠른 선택 목록 */}
            {executiveUsers.length > 0 && (
              <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.85rem', background: '#f5f7ff', borderRadius: '8px', border: '1px solid #dce4ff' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--gw-blue-700)', marginBottom: '0.4rem' }}>
                  👔 주요 결재자 (대표이사·이사·지사장·팀장 등) 빠른 선택
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {executiveUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="gw-secondary-button"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#fff' }}
                      onClick={() => {
                        setCustomLines((cur) => [...cur, { step_order: cur.length + 1, step_kind: 'approval', line_mode: 'sequential', required_count: 1, is_blocking: true, assignee_user_ids: [user.id] }]);
                      }}
                    >
                      + {user.name} <small style={{ color: 'var(--gw-muted)' }}>({user.position_name || user.department_name || '임원/팀장'})</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 결재자 콤보박스 선택 */}
            <label className="gw-field">
              <span>결재자 선택 (등록된 직원 콤보박스)</span>
              <select
                onChange={(event) => {
                  const userId = event.target.value;
                  if (!userId) return;
                  setCustomLines((cur) => [...cur, { step_order: cur.length + 1, step_kind: 'approval', line_mode: 'sequential', required_count: 1, is_blocking: true, assignee_user_ids: [userId] }]);
                  event.target.value = '';
                }}
              >
                <option value="">-- 등록된 직원 콤보박스에서 결재자 선택 --</option>
                {catalog.users
                  .filter((user) => user.id !== auth.user?.id && !new Set((customLines ?? []).flatMap((l) => l.assignee_user_ids ?? [])).has(user.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.position_name || user.job_title_name || '직급 미등록'} ({user.department_name || '소속 미등록'})
                    </option>
                  ))}
              </select>
            </label>

            <div className="gw-custom-approval-lines">
              {customLines.map((line, index) => {
                const user = catalog.users.find((item) => item.id === line.assignee_user_ids?.[0]);
                return (
                  <div key={`${line.assignee_user_ids?.[0]}-${index}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{user?.name ?? '지정 사용자'}</strong>
                      <small>{user?.department_name ?? '소속 미등록'} · {user?.position_name ?? '직급 미등록'}</small>
                    </div>
                    <div className="gw-admin-actions">
                      <button type="button" disabled={index === 0} onClick={() => setCustomLines(moveItem(customLines, index, index - 1))}>위로</button>
                      <button type="button" disabled={index === customLines.length - 1} onClick={() => setCustomLines(moveItem(customLines, index, index + 1))}>아래로</button>
                      <button type="button" onClick={() => setCustomLines(customLines.filter((_, i) => i !== index))}>삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {customLines.length === 0 && <p className="gw-empty-state">위 콤보박스에서 결재자를 순서대로 선택해 주세요.</p>}
          </>
        )}
      </section>

      {/* 참조·열람자 */}
      <section className="gw-approval-card">
        <h2>참조·열람자</h2>
        <label className="gw-field">
          <span>참조자 선택 (등록된 직원 콤보박스)</span>
          <select
            onChange={(event) => {
              const userId = event.target.value;
              if (!userId) return;
              if (!references.some((r) => r.user_id === userId)) {
                setReferences((cur) => [...cur, { user_id: userId, reference_type: 'reference' }]);
              }
              event.target.value = '';
            }}
          >
            <option value="">-- 등록된 직원 콤보박스에서 참조자 선택 --</option>
            {catalog.users
              .filter((user) => user.id !== auth.user?.id && !references.some((r) => r.user_id === user.id))
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.position_name || user.job_title_name || '직급 미등록'} ({user.department_name || '소속 미등록'})
                </option>
              ))}
          </select>
        </label>
        <div className="gw-reference-chips">
          {references.map((item) => {
            const user = catalog.users.find((c) => c.id === item.user_id);
            return (
              <div key={item.user_id}>
                <strong>{user?.name ?? '사용자'}</strong>
                <select aria-label={`${user?.name ?? '사용자'} 권한`} value={item.reference_type} onChange={(event) => setReferences((cur) => cur.map((c) => c.user_id === item.user_id ? { ...c, reference_type: event.target.value } : c))}>
                  <option value="reference">참조</option>
                  <option value="reader">열람</option>
                </select>
                <button type="button" onClick={() => setReferences((cur) => cur.filter((c) => c.user_id !== item.user_id))}>삭제</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 첨부파일 */}
      <section className="gw-approval-card">
        <h2>첨부파일</h2>
        {existingAttachments.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--gw-text-secondary)' }}>등록된 첨부파일</h3>
            <ul className="gw-approval-attachments">
              {existingAttachments.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.original_name}</strong>
                    <span>{formatBytes(item.file_size)}</span>
                  </div>
                  <div className="gw-admin-actions">
                    <a className="gw-secondary-button" href={item.download_url} target="_blank" rel="noreferrer">다운로드</a>
                    <button className="gw-secondary-button" type="button" onClick={async () => {
                      try {
                        await approvalService.deleteAttachment(item.id);
                        setExistingAttachments((prev) => prev.filter((a) => a.id !== item.id));
                      } catch (error) {
                        setStatus(`첨부파일 삭제에 실패했습니다. ${error?.message ?? ''}`);
                      }
                    }}>삭제</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="gw-field">
          <span>{existingAttachments.length > 0 ? '새 파일 추가 (최대 10개, 파일당 20MB)' : '파일 선택 (최대 10개, 파일당 20MB)'}</span>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.zip,.docx,.xlsx" onChange={(event) => setAttachmentFiles(Array.from(event.target.files ?? []).slice(0, 10))} />
        </label>
        {attachmentFiles.length > 0 && (
          <ul className="gw-file-selection">
            {attachmentFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name}</span>
                <small>{formatBytes(file.size)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="gw-admin-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button className="gw-secondary-button" type="button" onClick={() => navigate('/approval/outbox')}>목록 보기</button>
        <button className="gw-secondary-button" type="button" disabled={submitting} onClick={() => save()}>임시 저장</button>
        <button className="gw-primary-button" type="button" disabled={submitting} onClick={() => save({ submit: true })}>{submitting ? '처리 중…' : '기안 요청'}</button>
      </div>

      {status && <p className="gw-form-status" role="status">{status}</p>}
    </article>
  );
}

function moveItem(items, from, to) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((line, index) => ({ ...line, step_order: index + 1 }));
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function ApprovalField({ field, value, onChange }) {
  const common = { required: Boolean(field.required), value, onChange: (event) => onChange(event.target.value) };
  if (field.type === 'textarea') return <label className="gw-field gw-field--full"><span>{field.label}{field.required ? ' *' : ''}</span><textarea {...common} /></label>;
  if (field.type === 'select') return <label className="gw-field"><span>{field.label}{field.required ? ' *' : ''}</span><select {...common}><option value="">선택</option>{(field.options ?? []).map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select></label>;
  return <label className="gw-field"><span>{field.label}{field.required ? ' *' : ''}</span><input type={['number', 'date', 'text'].includes(field.type) ? field.type : 'text'} {...common} /></label>;
}

const stepKindLabel = (kind) => ({ approval: '결재', agreement: '합의', cooperation: '협조' }[kind] ?? kind);
const lineModeLabel = (line) => line.line_mode === 'parallel_required_count' ? `${line.required_count ?? 1}명 승인` : line.line_mode === 'parallel_all' ? '전원 승인' : '순차 처리';
function lineTargetLabel(line, userNames) {
  if (Array.isArray(line.assignee_user_ids)) return line.assignee_user_ids.map((id) => userNames[id] ?? '지정 사용자').join(', ');
  if (line.target_type === 'management') return '관리자 중 1명';
  if (line.target_type === 'drafter_department_head') return '기안자 부서장';
  return line.target_id || '양식 지정 대상';
}

function formatApprovalError(error) {
  const message = String(error?.message || '');
  if (message.includes('approval_line_has_no_assignee')) return '결재선에 결재자가 지정되지 않았습니다. [직접 지정] 버튼을 눌러 결재자를 선택해 주세요.';
  if (message.includes('approval_line_required')) return '최소 1명 이상의 결재자를 결재선에 포함해야 합니다.';
  if (message.includes('approval_required_count_exceeds_assignees')) return '결재선 인원이 양식의 최소 승인 필요 인원보다 적습니다.';
  if (message.includes('approval_template_unavailable')) return '선택한 결재 양식을 현재 사용할 수 없습니다.';
  if (message.includes('approved_member_required')) return '승인된 조직원만 기안서를 작성할 수 있습니다.';
  if (message.includes('approval_submit_denied')) return '본인이 작성한 임시 저장/반려/회수 문서만 기안 제출할 수 있습니다.';
  if (message.includes('approval_draft_update_denied')) return '임시 저장, 반려 또는 회수된 본인 문서만 수정할 수 있습니다.';
  if (message.includes('invalid_approval_title')) return '제목은 1~240자 이내로 입력해 주세요.';
  return `처리하지 못했습니다. ${error?.message ?? '입력값과 결재선을 확인해 주세요.'}`;
}
