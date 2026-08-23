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
      <Route path="*" element={<Navigate to="/groupware/approval" replace />} />
    </Routes>
  );
};

export default ApprovalRoutes;
