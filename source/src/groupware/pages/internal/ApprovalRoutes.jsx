import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ApprovalHomePage from './ApprovalHomePage';
import ApprovalDraftPage from './ApprovalDraftPage';
import ApprovalListPage from './ApprovalListPage';
import ApprovalDocumentPage from './ApprovalDocumentPage';
import ApprovalAdminPage from './ApprovalAdminPage';
import ApprovalCredentialsPage from './ApprovalCredentialsPage';

const ApprovalRoutes = () => {
  return (
    <>
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
