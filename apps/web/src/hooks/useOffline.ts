import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { getSyncStatus } from '@/lib/db';

export function useOffline() {
  const { isOnline, isSyncing, pendingSyncCount, setOnline, setPendingSyncCount } = useUIStore();
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Update sync status periodically
    const updateSyncStatus = async () => {
      const status = await getSyncStatus();
      setPendingSyncCount(status.totalPending);
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [setPendingSyncCount]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return {
    isOnline,
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    hasUnsyncedChanges: pendingSyncCount > 0,
  };
}
