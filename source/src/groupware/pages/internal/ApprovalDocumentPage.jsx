import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { approvalService } from '../../services/approvalService.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ApprovalDocumentPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [credentialId, setCredentialId] = useState('');
  const [comment, setComment] = useState('');

  const load = async () => {
    setLoading(true);
    try { setDoc(await approvalService.getDocument(documentId)); setError(''); }
    catch (loadError) { setError(loadError?.message ?? '문서를 찾을 수 없거나 접근 권한이 없습니다.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [documentId]);
  useEffect(() => { approvalService.getCredentials().then((items) => { setCredentials(items); setCredentialId(items.find((item) => item.is_default)?.id ?? items[0]?.id ?? ''); }).catch(() => setCredentials([])); }, [documentId]);

  const currentLines = useMemo(() => (doc?.lines ?? []).filter((line) => line.revision_id === doc.current_revision_id).sort((a, b) => a.step_order - b.step_order), [doc]);
  const formLabels = useMemo(() => Object.fromEntries((doc?.template_version?.form_schema ?? []).map((field) => [field.key, field.label])), [doc]);

  const processAction = async (assignment, action) => {
    let opinion = '';
    if (action === 'approve') {
      if (!credentialId) { setError('승인하려면 먼저 결재용 도장이나 서명을 등록해 주세요.'); return; }
      if (!window.confirm('이 문서를 승인하시겠습니까?')) return;
      opinion = '';
    } else if (action === 'release_hold') {
      if (!window.confirm('보류를 해제하고 결재를 계속하시겠습니까?')) return;
    } else {
      opinion = window.prompt(action === 'reject' ? '반려 사유를 입력하세요.' : '보류 사유를 입력하세요.') ?? '';
      if (opinion.trim().length < 2) return;
    }
    setBusy(true);
    try { await approvalService.processSignedAction(documentId, assignment.assignee_id, action, opinion, action === 'approve' ? credentialId : null); await load(); }
    catch (actionError) { setError(actionError?.message ?? '결재 처리를 완료하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const recall = async () => {
    const reason = window.prompt('회수 사유를 입력하세요.') ?? '';
    if (reason.trim().length < 2) return;
    setBusy(true);
    try { await approvalService.recallDocument(documentId, reason); await load(); }
    catch (actionError) { setError(actionError?.message ?? '문서를 회수하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const archive = async () => {
    const reason = window.prompt('보관 사유를 입력하세요.') ?? '';
    if (reason.trim().length < 2) return;
    setBusy(true);
    try { await approvalService.archiveDocument(documentId, reason); navigate('/approval/outbox'); }
    catch (actionError) { setError(actionError?.message ?? '문서를 보관하지 못했습니다.'); setBusy(false); }
  };

  const cancelByAdmin = async () => {
    const reason = window.prompt('관리자 취소 사유를 입력하세요. 이 작업은 감사 로그에 기록됩니다.') ?? '';
    if (reason.trim().length < 2) return;
    setBusy(true);
    try { await approvalService.adminCancelDocument(documentId, reason); await load(); }
    catch (actionError) { setError(actionError?.message ?? '문서를 취소하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try { await approvalService.addComment(documentId, comment.trim()); setComment(''); await load(); }
    catch (commentError) { setError(commentError?.message ?? '의견을 등록하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="gw-empty-state" role="status">결재 문서를 불러오고 있습니다.</p>;
  if (!doc) return <div className="gw-notice gw-notice--warning" role="alert">{error || '문서를 찾을 수 없거나 접근 권한이 없습니다.'}</div>;
  const actions = doc.availableActions ?? {};

  return <article className="gw-approval-page" aria-labelledby="approval-document-title">
    <header className="gw-approval-heading">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button type="button" className="gw-back-icon-button" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div>
          <div className="gw-approval-kicker">
            <span>{doc.template?.name ?? '결재 문서'}</span>
            <span>{doc.document_number || '문서번호 미발급'}</span>
          </div>
          <h1 id="approval-document-title">{doc.title}</h1>
          <p>{doc.revision?.drafter_snapshot?.name ?? '기안자'} · {new Date(doc.submitted_at ?? doc.created_at).toLocaleString('ko-KR')}</p>
        </div>
      </div>
      <div className="gw-admin-actions gw-no-print">
        <button className="gw-secondary-button" type="button" onClick={() => navigate('/approval')}>목록 보기</button>
        <button className="gw-secondary-button" type="button" onClick={() => window.print()}>인쇄</button>
        <span className={`gw-approval-status is-${doc.status}`}>{statusLabel(doc.status)}</span>
      </div>
    </header>
    {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}

    {/* 우측 정렬 결재란 (기안/결재/결재 칸칸이 출력) & 참조자 (칸 없이 이름만) */}
    <section className="gw-approval-card gw-stamp-section">
      <div className="gw-stamp-container">
        <div className="gw-stamp-grid">
          {/* 기안자 박스 */}
          <div className="gw-stamp-box">
            <div className="gw-stamp-header">기안</div>
            <div className="gw-stamp-body">
              <span className="gw-stamp-pos">{doc.revision?.drafter_snapshot?.position_name || doc.revision?.drafter_snapshot?.department_name || '기안자'}</span>
              <strong className="gw-stamp-name">{doc.revision?.drafter_snapshot?.name ?? '-'}</strong>
              <div className="gw-stamp-status is-approved">
                <span className="gw-stamp-badge">기안</span>
                <small>{doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString('ko-KR') : new Date(doc.created_at).toLocaleDateString('ko-KR')}</small>
              </div>
            </div>
          </div>

          {/* 결재자 박스들 (우측으로 칸칸이 출력) */}
          {currentLines.map((line) => {
            const assignee = line.assignees?.[0];
            const name = assignee?.assignee_snapshot?.name ?? '결재자';
            const pos = assignee?.assignee_snapshot?.position_name || assignee?.assignee_snapshot?.department_name || '결재자';
            const matchedAction = (doc.actions || []).find((a) => a.actor_user_id === assignee?.assignee_user_id && a.action_type === 'approve');
            const stampUrl = matchedAction?.credential_snapshot?.preview_url;

            return (
              <div key={line.id} className={`gw-stamp-box is-${assignee?.status || line.status}`}>
                <div className="gw-stamp-header">{stepKindLabel(line.step_kind)}</div>
                <div className="gw-stamp-body">
                  <span className="gw-stamp-pos">{pos}</span>
                  <strong className="gw-stamp-name">{name}</strong>
                  <div className={`gw-stamp-status is-${assignee?.status || 'waiting'}`}>
                    {stampUrl ? (
                      <img src={stampUrl} alt="서명/도장" className="gw-stamp-img" />
                    ) : (
                      <span className="gw-stamp-badge">{assigneeStatusLabel(assignee?.status || 'waiting')}</span>
                    )}
                    {matchedAction?.created_at && (
                      <small>{new Date(matchedAction.created_at).toLocaleDateString('ko-KR')}</small>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 참조자: 칸은 없고 이름만 출력 */}
      {Array.isArray(doc.references) && doc.references.length > 0 && (
        <div className="gw-approval-reference-plain">
          <strong className="gw-ref-title">참조:</strong>{' '}
          <span className="gw-ref-names">
            {doc.references
              .map((ref) => `${ref.user_name || ref.name || '참조자'}${ref.position_name ? ` ${ref.position_name}` : ''}${ref.department_name ? ` (${ref.department_name})` : ''}`)
              .join(', ')}
          </span>
        </div>
      )}
    </section>

    <section className="gw-approval-card"><div className="gw-approval-facts"><div><span>기안자</span><strong>{doc.revision?.drafter_snapshot?.name ?? '-'}</strong></div><div><span>소속</span><strong>{doc.revision?.drafter_snapshot?.department_name ?? '-'}</strong></div><div><span>문서 상태</span><strong>{statusLabel(doc.status)}</strong></div><div><span>현재 단계</span><strong>{doc.current_step_order || '-'}</strong></div></div></section>

    {Object.keys(doc.revision?.form_data ?? {}).length > 0 && <section className="gw-approval-card"><h2>양식 내용</h2><dl className="gw-approval-form-data">{Object.entries(doc.revision.form_data).map(([key, value]) => <div key={key}><dt>{formLabels[key] ?? key}</dt><dd>{String(value || '-')}</dd></div>)}</dl></section>}

    <section className="gw-approval-card"><h2>상세 내용</h2><div className="gw-approval-document-body"><ApprovalBody bodyJson={doc.revision?.body_json} /></div></section>

    <section className="gw-approval-card"><h2>첨부파일</h2>{doc.attachments?.length > 0 ? <ul className="gw-approval-attachments">{doc.attachments.map((item) => <li key={item.id}><div><strong>{item.original_name}</strong><span>{formatBytes(item.file_size)}</span></div><div className="gw-admin-actions gw-no-print"><a className="gw-secondary-button" href={item.download_url} target="_blank" rel="noreferrer">다운로드</a>{doc.status === 'draft' && actions.can_edit && <button className="gw-secondary-button" type="button" onClick={async () => { await approvalService.deleteAttachment(item.id); await load(); }}>삭제</button>}</div></li>)}</ul> : <p className="gw-empty-state">첨부파일이 없습니다.</p>}</section>

    <section className="gw-approval-card"><h2>결재 진행 정보</h2><div className="gw-approval-lines">{currentLines.map((line) => <div className={`gw-approval-line is-${line.status}`} key={line.id}><span className="gw-approval-line-order">{line.step_order}</span><div className="gw-approval-line-main"><header><strong>{stepKindLabel(line.step_kind)}</strong><span>{lineStatusLabel(line.status)}</span></header><div className="gw-approval-assignees">{line.assignees?.map((assignee) => <div key={assignee.id}><strong>{assignee.assignee_snapshot?.name ?? '결재자'}</strong><span>{assignee.assignee_snapshot?.department_name ?? ''} {assignee.assignee_snapshot?.position_name ?? ''}</span><em>{assigneeStatusLabel(assignee.status)}</em></div>)}</div></div></div>)}</div></section>

    {(actions.assignments?.length > 0 || actions.can_edit || actions.can_recall || actions.can_archive) && <section className="gw-approval-card"><h2>처리 작업</h2>{actions.assignments?.some((item) => item.can_approve) && <div className="gw-approval-sign-choice"><label className="gw-field"><span>승인 도장·서명</span><select value={credentialId} onChange={(event) => setCredentialId(event.target.value)}><option value="">선택</option>{credentials.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.credential_type === 'stamp' ? '도장' : '서명'}</option>)}</select></label>{credentialId && <img src={credentials.find((item) => item.id === credentialId)?.preview_url} alt="선택한 결재 표시 미리보기" />}{credentials.length === 0 && <Link className="gw-secondary-button" to="/approval/credentials">도장·서명 등록</Link>}</div>}{actions.assignments?.map((assignment) => <div className="gw-approval-action-row" key={assignment.assignee_id}><div><strong>{assignment.step_order}단계 {stepKindLabel(assignment.step_kind)}</strong></div><div className="gw-admin-actions">{assignment.can_approve && <button className="gw-primary-button" type="button" disabled={busy || !credentialId} onClick={() => processAction(assignment, 'approve')}>도장·서명 승인</button>}{assignment.can_reject && <button className="gw-secondary-button gw-secondary-button--danger" type="button" disabled={busy} onClick={() => processAction(assignment, 'reject')}>반려</button>}{assignment.can_hold && <button className="gw-secondary-button" type="button" disabled={busy} onClick={() => processAction(assignment, 'hold')}>보류</button>}{assignment.can_release_hold && <button className="gw-secondary-button" type="button" disabled={busy} onClick={() => processAction(assignment, 'release_hold')}>보류 해제</button>}</div></div>)}<div className="gw-admin-actions"><button className="gw-secondary-button" type="button" onClick={() => navigate('/approval')}>목록 보기</button>{actions.can_edit && <Link className="gw-secondary-button" to={`/approval/documents/${documentId}/edit`}>기안서 수정</Link>}{actions.can_recall && <button className="gw-secondary-button" type="button" disabled={busy} onClick={recall}>회수</button>}{actions.can_archive && <button className="gw-secondary-button" type="button" disabled={busy} onClick={archive}>보관</button>}</div></section>}

    {doc.actions?.length > 0 && <section className="gw-approval-card"><h2>처리 이력</h2><ol className="gw-approval-history">{[...doc.actions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((action) => <li key={action.id}><div><strong>{actionLabel(action.action_type)}</strong><span>{action.actor_snapshot?.name ?? '사용자'}</span></div><p>{action.opinion || '의견 없음'}</p>{action.credential_snapshot?.preview_url ? <figure className="gw-approval-history-mark"><img src={action.credential_snapshot.preview_url} alt={`${action.credential_snapshot.label} 결재 표시`} /><figcaption>{action.credential_snapshot.label}</figcaption><time>{new Date(action.created_at).toLocaleString('ko-KR')}</time></figure> : <time>{new Date(action.created_at).toLocaleString('ko-KR')}</time>}</li>)}</ol></section>}
    {actions.can_admin_cancel && auth.activeRole === 'super_admin' && <section className="gw-approval-card gw-no-print"><h2>최고관리자 작업</h2><p>진행 오류나 규정 위반 문서를 사유와 함께 강제 취소합니다.</p><button className="gw-secondary-button gw-secondary-button--danger" type="button" disabled={busy} onClick={cancelByAdmin}>문서 강제 취소</button></section>}

    <section className="gw-approval-card gw-no-print"><h2>의견</h2><form className="gw-comment-form" onSubmit={addComment}><label className="gw-field"><span>의견 작성</span><textarea maxLength="2000" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="결재 문서에 대한 의견을 남겨 주세요." /></label><button className="gw-primary-button" disabled={busy || !comment.trim()}>의견 등록</button></form><ol className="gw-approval-comments">{(doc.comments ?? []).filter((item) => !item.deleted_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((item) => <li key={item.id}><div><strong>{item.author_snapshot?.name ?? '사용자'}</strong><span>{item.author_snapshot?.department_name ?? ''}</span><time>{new Date(item.created_at).toLocaleString('ko-KR')}</time></div><p>{item.content}</p>{item.author_user_id === auth.user?.id && <button type="button" onClick={async () => { await approvalService.deleteComment(item.id); await load(); }}>삭제</button>}</li>)}</ol></section>
  </article>;
}

function ApprovalBody({ bodyJson }) {
  const paragraphs = (bodyJson?.content ?? []).map((paragraph) => (paragraph.content ?? []).map((node) => node.text ?? '').join(''));
  if (!paragraphs.some(Boolean)) return <p>작성된 상세 내용이 없습니다.</p>;
  return paragraphs.map((paragraph, index) => <p key={index}>{paragraph || <br />}</p>);
}

const statusLabel = (status) => ({ draft:'임시 저장',submitted:'제출',in_progress:'결재 진행',held:'보류',approved:'승인 완료',rejected:'반려',recalled:'회수',canceled:'취소',archived:'보관' }[status] ?? status);
const stepKindLabel = (kind) => ({ approval:'결재',agreement:'합의',cooperation:'협조' }[kind] ?? kind);
const lineStatusLabel = (status) => ({ waiting:'대기',active:'진행 중',approved:'완료',rejected:'반려',held:'보류',skipped:'건너뜀',canceled:'취소' }[status] ?? status);
const assigneeStatusLabel = (status) => ({ waiting:'예정',pending:'처리 대기',approved:'승인',rejected:'반려',held:'보류',delegated:'위임',skipped:'종료' }[status] ?? status);
const actionLabel = (action) => ({ submit:'기안 제출',resubmit:'재기안',approve:'승인',reject:'반려',hold:'보류',release_hold:'보류 해제',recall:'회수',cancel:'취소',archive:'보관',admin_override:'관리자 강제 취소' }[action] ?? action);

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}
