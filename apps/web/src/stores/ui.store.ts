import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingSyncCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingSyncCount: 0,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
}));

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useUIStore.getState().setOnline(true));
  window.addEventListener('offline', () => useUIStore.getState().setOnline(false));
}
