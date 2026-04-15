import { useAuthStore } from '../stores/authStore';

/**
 * Returns whether the current user has the given permission.
 * Logs a console warning when the permission is missing.
 */
export function usePermission(permissionKey: string): boolean {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const has = permissions.includes(permissionKey);
  if (!has) {
    console.warn(`[usePermission] Missing permission: ${permissionKey}`);
  }
  return has;
}

/** True if the user has every listed permission (no console warnings). */
export function useAllPermissions(keys: string[]): boolean {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  return keys.every((k) => permissions.includes(k));
}

/** True if the user has at least one of the given permissions. */
export function useAnyPermission(keys: string[]): boolean {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  return keys.some((k) => permissions.includes(k));
}

/** Primary app role (first role from the token user), or null. */
export function useRole(): string | null {
  return useAuthStore((state) => state.user?.roles?.[0] ?? null);
}
