import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import { approvalService } from '../../services/approvalService.js';

export default function ApprovalHomePage() {
  const auth = useAuth();
  const [summary, setSummary] = useState({ inbox: 0, outbox: 0, drafts: 0, completed: 0, recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    approvalService.getHomeSummary().then((data) => { setSummary(data); setError(''); }).catch((loadError) => setError(loadError?.message ?? '전자결재 현황을 불러오지 못했습니다.')).finally(() => setLoading(false));
  }, []);

  return <article className="gw-approval-page" aria-labelledby="approval-home-title">
    <header className="gw-approval-heading"><div><span className="gw-eyebrow">E-APPROVAL</span><h1 id="approval-home-title">전자결재</h1><p>결재 현황을 확인하고 새 기안을 시작하세요.</p></div><div className="gw-admin-actions">{['admin','super_admin'].includes(auth.activeRole) && <Link to="/approval/admin/templates" className="gw-secondary-button">결재 관리</Link>}<Link to="/approval/credentials" className="gw-secondary-button">도장·서명</Link><Link to="/approval/new" className="gw-primary-button">새 기안 작성</Link></div></header>
    {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
    <section className="gw-approval-summary" aria-label="전자결재 현황">{[['inbox','결재 대기','/approval/inbox'],['outbox','진행 중 기안','/approval/outbox'],['drafts','임시 보관','/approval/drafts'],['completed','완료 문서','/approval/completed']].map(([key,label,path]) => <Link key={key} to={path}><span>{label}</span><strong>{loading ? '–' : summary[key] ?? 0}</strong><small>문서 보기</small></Link>)}</section>
    <section className="gw-approval-card"><div className="gw-approval-card-heading"><h2>최근 결재 문서</h2><Link to="/approval/outbox">전체 보기</Link></div>{summary.recent?.length > 0 ? <ul className="gw-approval-recent">{summary.recent.map((item) => <li key={item.id}><Link to={`/approval/documents/${item.id}`}><div><strong>{item.title}</strong><span>{item.document_number || '문서번호 미발급'} · {statusLabel(item.status)}</span></div><time>{new Date(item.updated_at).toLocaleDateString('ko-KR')}</time></Link></li>)}</ul> : <p className="gw-empty-state">최근 결재 문서가 없습니다.</p>}</section>
  </article>;
}

const statusLabel = (status) => ({ draft:'임시 저장',in_progress:'결재 진행',held:'보류',approved:'승인 완료',rejected:'반려',recalled:'회수',canceled:'취소',archived:'보관' }[status] ?? status);
