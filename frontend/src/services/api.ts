import axios from 'axios';

// Type for the auth store getter to avoid circular dependencies
export type AuthStore = {
  token: string | null;
  universityId: string | null;
  clearAuth: () => void;
};

// Getter function to be set by the auth store
let getAuthStore: (() => AuthStore) | null = null;

export const setAuthStoreGetter = (getter: () => AuthStore) => {
  getAuthStore = getter;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization and X-University-Id headers
api.interceptors.request.use(
  (config) => {
    if (getAuthStore) {
      const authStore = getAuthStore();
      
      // Attach Authorization header if token exists
      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
      }
      
      // Attach X-University-Id header if universityId exists
      if (authStore.universityId) {
        config.headers['X-University-Id'] = authStore.universityId;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: handle 401 errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      if (getAuthStore) {
        const authStore = getAuthStore();
        authStore.clearAuth();
      }
      
      // Redirect to login page
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;
