import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization, Store, AuthSession } from '@pos/shared';
import { api } from '@/lib/api/client';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  store: Store | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  loginWithPin: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      store: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email: string, password: string) => {
        const response = await api.post<AuthSession>('/api/auth/login', {
          email,
          password,
        });

        if (!response.success || !response.data) {
          throw new Error('Login failed');
        }

        get().setSession(response.data);
      },

      loginWithPin: async (userId: string, pin: string) => {
        const response = await api.post<AuthSession>('/api/auth/login/pin', {
          userId,
          pin,
        });

        if (response.success && response.data) {
          get().setSession(response.data);
        }
      },

      logout: async () => {
        try {
          await api.post('/api/auth/logout');
        } catch {
          // Ignore errors during logout
        }
        get().clearSession();
      },

      setSession: (session: AuthSession) => {
        api.setTokens(session.tokens.accessToken, session.tokens.refreshToken);
        set({
          user: session.user,
          organization: session.organization,
          store: session.store,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      clearSession: () => {
        api.clearTokens();
        set({
          user: null,
          organization: null,
          store: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      initialize: async () => {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
          set({ isLoading: false });
          return;
        }

        try {
          // Verify token by fetching current user
          const response = await api.get<{ userId: string }>('/api/auth/me');
          if (response.success) {
            // Token is valid, state should be restored from persist
            set({ isAuthenticated: true, isLoading: false });
          } else {
            get().clearSession();
          }
        } catch {
          get().clearSession();
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        store: state.store,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, set isLoading to false
        if (state) {
          state.isLoading = false;
        }
      },
    }
  )
);

// Set up unauthorized handler
api.setOnUnauthorized(() => {
  useAuthStore.getState().clearSession();
  window.location.href = '/login';
});
