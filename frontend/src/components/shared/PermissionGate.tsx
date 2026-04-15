import type { ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface PermissionGateProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children when the user has the required permission(s).
 * For an array, every permission is required (AND).
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const keys = Array.isArray(permission) ? permission : [permission];
  const has = keys.every((k) => permissions.includes(k));

  if (has) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
