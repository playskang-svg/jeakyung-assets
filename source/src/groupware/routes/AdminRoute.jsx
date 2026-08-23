import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export default function AdminRoute() {
  const auth = useAuth();

  if (!['admin', 'super_admin'].includes(auth.activeRole)) {
    return <Navigate to="/dashboard" replace state={{ reason: 'admin-required' }} />;
  }

  return <Outlet />;
}
