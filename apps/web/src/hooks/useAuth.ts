import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';

// Track if initialization has been done globally
let hasInitialized = false;

export function useAuth() {
  const {
    user,
    organization,
    store,
    isAuthenticated,
    isLoading,
    login,
    loginWithPin,
    logout,
    initialize,
  } = useAuthStore();

  const initRef = useRef(false);

  useEffect(() => {
    // Only initialize once globally
    if (!hasInitialized && !initRef.current) {
      initRef.current = true;
      hasInitialized = true;
      initialize();
    }
  }, [initialize]);

  return {
    user,
    organization,
    store,
    isAuthenticated,
    isLoading,
    login,
    loginWithPin,
    logout,
  };
}
