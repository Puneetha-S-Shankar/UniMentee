import type { ReactNode } from 'react';
import { usePermission } from '../../hooks/usePermission';

interface PermissionGateProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * PermissionGate component that conditionally renders children based on user permissions
 * @param permission - A single permission string or an array of permission strings (all required)
 * @param children - Content to render if the user has the required permission(s)
 * @param fallback - Optional content to render if the user lacks permission (default: null)
 */
export function PermissionGate({ 
  permission, 
  children, 
  fallback = null 
}: PermissionGateProps) {
  const hasPermission = usePermission(permission);

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
