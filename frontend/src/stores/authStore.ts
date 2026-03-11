  import { create } from 'zustand';

  // Define the auth state interface
  interface AuthState {
    token: string | null;
    userId: number | null;
    universityId: number | null;
    role: string | null;
    permissions: string[];
  }

  // Define the auth actions interface
  interface AuthActions {
    setAuth: (
      token: string,
      userId: number,
      universityId: number,
      role: string,
      permissions: string[]
    ) => void;
    clearAuth: () => void;
  }

  // Combine state and actions
  export type AuthStore = AuthState & AuthActions;

  // Local storage key
  const TOKEN_KEY = 'auth_token';

  // Helper function to get token from localStorage
  const getStoredToken = (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error reading token from localStorage:', error);
      return null;
    }
  };

  // Helper function to save token to localStorage
  const saveToken = (token: string): void => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token to localStorage:', error);
    }
  };

  // Helper function to remove token from localStorage
  const removeToken = (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token from localStorage:', error);
    }
  };

  // Create the Zustand store
  export const useAuthStore = create<AuthStore>((set) => ({
    // Initial state - rehydrate token from localStorage
    token: getStoredToken(),
    userId: null,
    universityId: null,
    role: null,
    permissions: [],

    // Actions
    setAuth: (token, userId, universityId, role, permissions) => {
      // Save token to localStorage
      saveToken(token);
      
      // Update state
      set({
        token,
        userId,
        universityId,
        role,
        permissions,
      });
    },

    clearAuth: () => {
      // Remove token from localStorage
      removeToken();
      
      // Clear all state
      set({
        token: null,
        userId: null,
        universityId: null,
        role: null,
        permissions: [],
      });
    },
  }));

  // Export selectors for convenient access to specific state slices
  export const selectToken = (state: AuthStore) => state.token;
  export const selectUserId = (state: AuthStore) => state.userId;
  export const selectUniversityId = (state: AuthStore) => state.universityId;
  export const selectRole = (state: AuthStore) => state.role;
  export const selectPermissions = (state: AuthStore) => state.permissions;
  export const selectIsAuthenticated = (state: AuthStore) => !!state.token;
