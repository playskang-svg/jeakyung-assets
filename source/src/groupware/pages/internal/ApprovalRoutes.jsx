import React from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import ApprovalHomePage from './ApprovalHomePage';
import ApprovalDraftPage from './ApprovalDraftPage';
import ApprovalListPage from './ApprovalListPage';
import ApprovalDocumentPage from './ApprovalDocumentPage';
import ApprovalAdminPage from './ApprovalAdminPage';
import ApprovalCredentialsPage from './ApprovalCredentialsPage';

// 전자결재는 화면이 여럿(홈·기안·목록·문서·관리)이라 어디까지 들어왔는지 잃기
// 쉽다. 사이드바를 없앤 뒤로는 더욱 그렇다. 그래서 모든 전자결재 화면 위에
// 같은 이동 줄을 둔다.
function ApprovalNav() {
  const navigate = useNavigate();
  // 새 탭이나 북마크로 바로 들어오면 돌아갈 이력이 없다. 그럴 때 navigate(-1)
  // 은 그룹웨어 바깥으로 나가 버리므로 전자결재 홈으로 보낸다.
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/approval');
  };
  return (
    <nav className="gw-subnav" aria-label="전자결재 이동">
      <button type="button" className="gw-subnav-back" onClick={goBack}>
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        뒤로가기
      </button>
      <Link to="/approval">목록</Link>
      <Link to="/dashboard">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></svg>
        홈으로
      </Link>
    </nav>
  );
}

const ApprovalRoutes = () => {
  return (
    <>
      <ApprovalNav />
      <Routes>
        <Route index element={<ApprovalHomePage />} />
        <Route path="new" element={<ApprovalDraftPage />} />
        <Route path="drafts" element={<ApprovalListPage type="drafts" />} />
        <Route path="inbox" element={<ApprovalListPage type="inbox" />} />
        <Route path="outbox" element={<ApprovalListPage type="outbox" />} />
        <Route path="completed" element={<ApprovalListPage type="completed" />} />
        <Route path="references" element={<ApprovalListPage type="references" />} />
        <Route path="credentials" element={<ApprovalCredentialsPage />} />
        <Route path="documents/:documentId" element={<ApprovalDocumentPage />} />
        <Route path="documents/:documentId/edit" element={<ApprovalDraftPage isEdit={true} />} />
        <Route path="admin/*" element={<ApprovalAdminPage />} />
        {/* 라우터 basename 이 이미 /groupware 다. 예전에는 여기에 /groupware/approval
            을 적어 두어 /groupware/groupware/approval 로 풀렸고, 그러면 어느
            라우트에도 걸리지 않아 로그인 화면까지 튕겨 나갔다. */}
        <Route path="*" element={<Navigate to="/approval" replace />} />
      </Routes>
    </>
  );
};

export default ApprovalRoutes;
