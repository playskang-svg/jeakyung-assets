import { Navigate, Outlet, useLocation } from 'react-router-dom';

import SupabaseConfigurationNotice from '../components/SupabaseConfigurationNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.configured) {
    return <main className="gw-route-state"><SupabaseConfigurationNotice /></main>;
  }

  if (auth.loading) {
    return <main className="gw-route-state" role="status">계정 상태를 확인하고 있습니다.</main>;
  }

  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}`, reason: 'authentication-required' }} />;
  }

  if (auth.status === 'pending') return <Navigate to="/pending" replace />;
  if (auth.status === 'rejected') return <Navigate to="/rejected" replace />;
  if (auth.status === 'locked') return <Navigate to="/locked" replace />;
  if (auth.status === 'resigned') return <Navigate to="/resigned" replace />;

  if (auth.status !== 'approved') {
    return (
      <main className="gw-route-state" role="alert">
        계정 프로필을 확인할 수 없습니다. 경영지원부에 문의해 주세요.
      </main>
    );
  }

  return <Outlet />;
}
