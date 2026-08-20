import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

// 로그인 후 role에 따라 salesperson/manager 라우트로 분기한다 (UC-002).
export default function RoleGuard({ role }) {
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) return <Navigate to={`/${session.role}`} replace />;

  return <Outlet />;
}
