import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext.jsx';
import AppShell from './layouts/AppShell.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import PendingPage from './pages/auth/PendingPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import SignupPage from './pages/auth/SignupPage.jsx';
import UpdatePasswordPage from './pages/auth/UpdatePasswordPage.jsx';
import BoardPage from './pages/internal/BoardPage.jsx';
import LinkTreePage from './pages/internal/LinkTreePage.jsx';
import BoardsPage from './pages/internal/BoardsPage.jsx';
import CalendarPage from './pages/internal/CalendarPage.jsx';
import DashboardPage from './pages/internal/DashboardPage.jsx';
import FilesPage from './pages/internal/FilesPage.jsx';
import OrganizationPage from './pages/internal/OrganizationPage.jsx';
import MyProfilePage from './pages/internal/MyProfilePage.jsx';
import PostDetailPage from './pages/internal/PostDetailPage.jsx';
import MembershipStatusPage from './pages/status/MembershipStatusPage.jsx';
import AdminRoute from './routes/AdminRoute.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

// 초기 대시보드 진입과 무관한 대형 라우트는 지연 로딩해 초기 번들 크기를 줄인다.
// (vercel-react-best-practices: 2.4 Dynamic Imports for Heavy Components)
const PostWritePage = lazy(() => import('./pages/internal/PostWritePage.jsx'));
const PopupAdminPage = lazy(() => import('./pages/internal/PopupAdminPage.jsx'));
const ApprovalRoutes = lazy(() => import('./pages/internal/ApprovalRoutes.jsx'));
const AdminPage = lazy(() => import('./pages/internal/AdminPage.jsx'));
const BoardAdminPage = lazy(() => import('./pages/internal/BoardAdminPage.jsx'));

function EditorRoute() {
  return <Suspense fallback={<p className="gw-empty-state" role="status">게시글 편집기를 불러오고 있습니다.</p>}><PostWritePage /></Suspense>;
}

function PopupAdminRoute() {
  return <Suspense fallback={<p className="gw-empty-state" role="status">팝업 문서 관리 화면을 불러오고 있습니다.</p>}><PopupAdminPage /></Suspense>;
}

function ApprovalRoute() {
  return <Suspense fallback={<p className="gw-empty-state" role="status">전자결재 화면을 불러오고 있습니다.</p>}><ApprovalRoutes /></Suspense>;
}

function AdminRoutePage() {
  return <Suspense fallback={<p className="gw-empty-state" role="status">관리자 화면을 불러오고 있습니다.</p>}><AdminPage /></Suspense>;
}

function BoardAdminRoutePage() {
  return <Suspense fallback={<p className="gw-empty-state" role="status">게시판 관리 화면을 불러오고 있습니다.</p>}><BoardAdminPage /></Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/groupware">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="pending" element={<PendingPage />} />
            <Route path="rejected" element={<MembershipStatusPage status="rejected" />} />
            <Route path="locked" element={<MembershipStatusPage status="locked" />} />
            <Route path="resigned" element={<MembershipStatusPage status="resigned" />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="reset-password/update" element={<UpdatePasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="profile" element={<MyProfilePage />} />
              <Route path="mypage" element={<Navigate to="/profile" replace />} />
              <Route path="organization" element={<OrganizationPage />} />
              <Route path="boards" element={<BoardsPage />} />
              <Route path="boards/:boardSlug" element={<BoardPage />} />
              <Route path="pages/:pageSlug" element={<LinkTreePage />} />
              <Route path="boards/:boardSlug/posts/:postId" element={<PostDetailPage />} />
              <Route path="boards/:boardSlug/posts/:postId/edit" element={<EditorRoute />} />
              <Route path="boards/:boardSlug/write" element={<EditorRoute />} />
              <Route path="approval/*" element={<ApprovalRoute />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="files" element={<FilesPage />} />
              <Route element={<AdminRoute />}>
                <Route path="admin" element={<AdminRoutePage />} />
                <Route path="admin/boards" element={<BoardAdminRoutePage />} />
                <Route path="admin/popups" element={<PopupAdminRoute />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
