import { useAuthStore } from '../stores/authStore';

/**
 * Hook to check if the current user has the required permission(s)
 * @param key - A single permission string or an array of permission strings
 * @returns true if the user has the permission(s), false otherwise
 */
export function usePermission(key: string | string[]): boolean {
  const permissions = useAuthStore((state) => state.permissions);

  if (typeof key === 'string') {
    return permissions.includes(key);
  }

  if (Array.isArray(key)) {
    return key.every((k) => permissions.includes(k));
  }

  return false;
}

/**
 * Hook to get the current user's role
 * @returns The user's role string or null if not authenticated
 */
export function useRole(): string | null {
  const role = useAuthStore((state) => state.role);
  return role;
}
