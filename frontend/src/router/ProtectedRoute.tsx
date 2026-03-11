import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * ProtectedRoute Component
 * 
 * Protects routes by checking for authentication token.
 * - If no token exists: Redirects to /login
 * - If token exists: Renders child routes via Outlet
 */
const ProtectedRoute = () => {
  const token = useAuthStore((state) => state.token);

  // If no token, redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If token exists, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;
