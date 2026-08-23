import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { approvalService } from '../../services/approvalService';
import { supabase } from '../../lib/supabase';

const ApprovalListPage = ({ type }) => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [type]);

  const loadDocuments = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      if (type === 'inbox') {
        const inbox = await approvalService.getInbox();
        setDocuments(inbox);
        return;
      }
      if (type === 'references') {
        setDocuments(await approvalService.getReferences());
        return;
      }

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('로그인이 필요합니다.');

      let query = supabase
        .from('approval_documents')
        .select(`
          *,
          template:template_id (name)
        `)
        .order('created_at', { ascending: false });

      if (type === 'drafts') {
        query = query
          .eq('drafter_user_id', user.id)
          .eq('status', 'draft');
      } else if (type === 'outbox') {
        query = query
          .eq('drafter_user_id', user.id)
          .in('status', [
            'submitted',
            'in_progress',
            'held',
            'rejected',
            'recalled'
          ]);
      } else if (type === 'completed') {
        query = query.eq('status', 'approved');
      }

      const { data, error } = await query;
      if (error) throw error;

      const drafterIds = Array.from(new Set((data || []).map((doc) => doc.drafter_user_id).filter(Boolean)));
      let drafterMap = {};
      if (drafterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, full_name, preferred_name')
          .in('id', drafterIds);
        if (profiles) {
          drafterMap = Object.fromEntries(
            profiles.map((p) => [p.id, p.preferred_name || p.full_name || p.name || '알 수 없음'])
          );
        }
      }

      const formatted = (data || []).map((doc) => ({
        ...doc,
        drafter_name: doc.drafter_name || drafterMap[doc.drafter_user_id] || '알 수 없음'
      }));

      setDocuments(formatted);
    } catch (error) {
      console.error('Failed to load approval documents', error);
      setDocuments([]);
      setErrorMessage(
        error?.message || '문서를 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const titles = {
      drafts: '임시 보관함',
      inbox: '결재 대기함',
      outbox: '기안 문서함',
      completed: '완료 문서함',
      references: '참조·열람함'
    };

    return titles[type] || '전자결재 문서';
  };

  const getTemplateName = (document) =>
    document.template_name ||
    document.template?.name ||
    '-';

  const getDrafterName = (document) =>
    document.drafter_name ||
    document.drafter?.preferred_name ||
    document.drafter?.full_name ||
    document.drafter?.name ||
    '-';

  const getDocumentDate = (document) => {
    const value =
      document.submitted_at ||
      document.created_at;

    if (!value) return '-';

    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
  };

  return (
    <article className="gw-approval-page" aria-labelledby="approval-list-title">
      <header className="gw-approval-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button type="button" className="gw-back-icon-button" onClick={() => navigate('/approval')} aria-label="전자결재 홈으로">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <span className="gw-eyebrow">E-APPROVAL</span>
            <h1 id="approval-list-title">{getTitle()}</h1>
            <p>권한이 있는 결재 문서를 최신 순서로 확인합니다.</p>
          </div>
        </div>
        <Link to="/approval/new" className="gw-primary-button">새 기안 작성</Link>
      </header>

      {loading ? (
        <div className="gw-approval-card gw-loading">불러오는 중…</div>
      ) : errorMessage ? (
        <div className="gw-approval-card gw-empty-state">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="gw-secondary-button"
            onClick={loadDocuments}
          >
            다시 시도
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="gw-approval-card gw-empty-state">
          <p>문서가 없습니다.</p>
        </div>
      ) : (
        <div className="gw-approval-card gw-approval-table-wrap">
          <table className="gw-approval-table">
            <thead>
              <tr>
                <th>문서번호</th>
                <th>양식</th>
                <th>제목</th>
                <th>기안자</th>
                <th>{type === 'inbox' ? '제출일' : '기안일'}</th>
                <th>상태</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => (
                <tr key={`${document.id}-${document.assignee_id || ''}`}>
                  <td>
                    {document.document_number || '미발급'}
                  </td>

                  <td>{getTemplateName(document)}</td>

                  <td>
                    <Link
                      to={type === 'drafts' || document.status === 'draft' ? `/approval/documents/${document.id}/edit` : `/approval/documents/${document.id}`}
                      className="gw-approval-document-link"
                      onClick={() => document.reference_id && !document.read_at && approvalService.markReferenceRead(document.reference_id).catch(() => {})}
                    >
                      {document.title || '제목 없음'}
                    </Link>

                    {document.reference_id && !document.read_at && <span className="gw-approval-delegated">새 문서</span>}
                  </td>

                  <td>{getDrafterName(document)}</td>

                  <td>
                    {getDocumentDate(document)}
                  </td>

                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className={`gw-approval-status is-${document.status}`}
                      >
                        {getStatusLabel(document.status)}
                      </span>
                      {(type === 'drafts' || ['draft', 'recalled', 'rejected'].includes(document.status)) && (
                        <Link
                          to={`/approval/documents/${document.id}/edit`}
                          className="gw-secondary-button"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                        >
                          수정
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
};

const getStatusLabel = (status) => {
  const labels = {
    draft: '임시 저장',
    submitted: '제출',
    in_progress: '결재 진행',
    held: '보류',
    approved: '승인 완료',
    rejected: '반려',
    recalled: '회수',
    canceled: '취소',
    archived: '보관'
  };

  return labels[status] || status || '-';
};

export default ApprovalListPage;
