import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ForbiddenPage from '../features/shared/pages/ForbiddenPage';

interface MeResponse {
  user_id: number;
  university_id: number;
  full_name: string;
  email: string;
  permissions: string[];
  roles: string[];
}

function hasAllPermissions(userPermissions: string[] | undefined, required: string[]): boolean {
  if (!required.length) return true;
  const p = userPermissions ?? [];
  return required.every((k) => p.includes(k));
}

export interface ProtectedRouteProps {
  /** When set with `children`, only permission checks run (no /auth/me); use inside an authenticated tree. */
  requiredPermissions?: string[];
  children?: ReactNode;
}

/**
 * - **Layout (no children):** requires token, hydrates user via `/auth/me` when needed, renders `<Outlet />`.
 * - **Gate (children):** requires token; if `requiredPermissions` is set, user must have every permission or see 403.
 */
export default function ProtectedRoute({ requiredPermissions, children }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const gateMode = children !== undefined;
  const [hydrating, setHydrating] = useState(() => !gateMode && !user && !!token);

  useEffect(() => {
    if (gateMode) return;
    if (!token || user) return;

    let cancelled = false;
    api
      .get<MeResponse>('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setAuth(token, {
          user_id: data.user_id,
          full_name: data.full_name,
          email: data.email,
          roles: data.roles,
          permissions: data.permissions,
        });
      })
      .catch(() => {
        if (!cancelled) clearAuth();
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gateMode, token, user, setAuth, clearAuth]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (gateMode) {
    if (!user) {
      return <LoadingSpinner />;
    }
    if (requiredPermissions?.length && !hasAllPermissions(user.permissions, requiredPermissions)) {
      return <ForbiddenPage />;
    }
    return <>{children}</>;
  }

  if (hydrating) {
    return <LoadingSpinner />;
  }

  return <Outlet />;
}
