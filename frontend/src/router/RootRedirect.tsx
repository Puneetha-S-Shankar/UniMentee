import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getHomeRoute } from '../lib/roleRoutes';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/**
 * `/` when authenticated: send user to their role dashboard.
 */
export default function RootRedirect() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <LoadingSpinner />;
  }

  if (!user.roles?.length) {
    return <Navigate to="/login" replace />;
  }

  const role = user.roles[0] ?? '';
  return <Navigate to={getHomeRoute(role)} replace />;
}
