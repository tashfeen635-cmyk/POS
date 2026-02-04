// Sync Status Indicator - Shows sync status in UI
import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUIStore } from '@/stores/ui.store';
import { performSync, retryFailedSyncs, getDetailedSyncStatus } from '@/lib/sync/engine';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export function SyncStatusIndicator() {
  const { isOnline, isSyncing, pendingSyncCount } = useUIStore();
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: syncDetails, refetch } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getDetailedSyncStatus,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleManualSync = async () => {
    await performSync();
    refetch();
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    await retryFailedSyncs();
    refetch();
    setIsRetrying(false);
  };

  // Determine status
  let status: 'online' | 'offline' | 'syncing' | 'pending' | 'error' = 'online';
  let statusColor = 'text-green-500';

  if (!isOnline) {
    status = 'offline';
    statusColor = 'text-gray-500';
  } else if (isSyncing) {
    status = 'syncing';
    statusColor = 'text-blue-500';
  } else if (syncDetails?.failed && syncDetails.failed > 0) {
    status = 'error';
    statusColor = 'text-red-500';
  } else if (pendingSyncCount > 0) {
    status = 'pending';
    statusColor = 'text-yellow-500';
  }

  const StatusIcon = () => {
    switch (status) {
      case 'offline':
        return <CloudOff className="h-4 w-4" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'pending':
        return <Cloud className="h-4 w-4" />;
      default:
        return <Check className="h-4 w-4" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-2', statusColor)}
        >
          <StatusIcon />
          {!isOnline && <span className="text-xs">Offline</span>}
          {pendingSyncCount > 0 && isOnline && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
              {pendingSyncCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Sync Status</h4>
            <span
              className={cn(
                'text-xs px-2 py-1 rounded-full',
                isOnline
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Sync stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded p-2">
              <p className="text-lg font-bold">{syncDetails?.pending || 0}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="bg-muted rounded p-2">
              <p className="text-lg font-bold">{syncDetails?.processing || 0}</p>
              <p className="text-xs text-muted-foreground">Syncing</p>
            </div>
            <div className="bg-muted rounded p-2">
              <p className="text-lg font-bold text-red-500">{syncDetails?.failed || 0}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Last sync time */}
          {syncDetails?.lastSyncTime && (
            <p className="text-xs text-muted-foreground">
              Last sync:{' '}
              {new Date(syncDetails.lastSyncTime).toLocaleString('en-PK', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleManualSync}
              disabled={!isOnline || isSyncing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
            {syncDetails?.failed && syncDetails.failed > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleRetryFailed}
                disabled={!isOnline || isRetrying}
              >
                {isRetrying ? 'Retrying...' : 'Retry Failed'}
              </Button>
            )}
          </div>

          {/* Recent failed items */}
          {syncDetails?.recentItems &&
            syncDetails.recentItems.filter((i) => i.status === 'failed').length > 0 && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium mb-1 text-red-600">Failed Items:</p>
                <div className="max-h-32 overflow-auto space-y-1">
                  {syncDetails.recentItems
                    .filter((i) => i.status === 'failed')
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="text-xs bg-red-50 p-1.5 rounded flex justify-between"
                      >
                        <span className="truncate">{item.table}</span>
                        <span className="text-muted-foreground">{item.operation}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
