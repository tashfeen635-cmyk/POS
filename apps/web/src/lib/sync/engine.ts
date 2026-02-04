// Production-ready Sync Engine with exponential backoff, priority queue, and conflict resolution
import { db, SYNC_STATUS, getSyncStatus } from '../db';
import type { SyncQueueItem } from '../db/schema';
import { api, AuthenticationError } from '../api/client';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { logger } from '../logging/logger';

// Create a child logger for sync operations
const syncLogger = logger.child({ module: 'sync' });

// Constants
const SYNC_INTERVAL = 30000; // 30 seconds
const MAX_SYNC_INTERVAL = 300000; // 5 minutes (when backing off)
const MAX_BATCH_SIZE = 50;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 300000; // 5 minutes

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let consecutiveErrors = 0;
let currentSyncInterval = SYNC_INTERVAL;

// Sync status event emitter
type SyncEventType = 'sync_start' | 'sync_complete' | 'sync_error' | 'sync_progress';
type SyncEventCallback = (event: { type: SyncEventType; data?: any }) => void;
const syncEventListeners: SyncEventCallback[] = [];

export function onSyncEvent(callback: SyncEventCallback): () => void {
  syncEventListeners.push(callback);
  return () => {
    const index = syncEventListeners.indexOf(callback);
    if (index > -1) syncEventListeners.splice(index, 1);
  };
}

function emitSyncEvent(type: SyncEventType, data?: any): void {
  syncEventListeners.forEach((cb) => cb({ type, data }));
}

// Initialize sync engine
export async function startSyncEngine() {
  syncLogger.info('Starting sync engine');

  // Perform initial sync
  await performSync();

  // Set up periodic sync with dynamic interval
  scheduleNextSync();

  // Listen for online events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen for visibility changes (sync when tab becomes visible)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  syncLogger.info('Sync engine started');
}

// Schedule next sync with dynamic interval based on error rate
function scheduleNextSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  syncInterval = setInterval(performSync, currentSyncInterval);
}

// Adjust sync interval based on consecutive errors (backoff)
function adjustSyncInterval(hadError: boolean) {
  if (hadError) {
    consecutiveErrors++;
    // Increase interval exponentially on errors (up to max)
    currentSyncInterval = Math.min(
      SYNC_INTERVAL * Math.pow(2, consecutiveErrors),
      MAX_SYNC_INTERVAL
    );
    syncLogger.debug('Sync backoff increased', {
      consecutiveErrors,
      newInterval: currentSyncInterval,
    });
  } else {
    // Reset on success
    if (consecutiveErrors > 0) {
      syncLogger.debug('Sync backoff reset after success');
    }
    consecutiveErrors = 0;
    currentSyncInterval = SYNC_INTERVAL;
  }

  // Reschedule with new interval
  scheduleNextSync();
}

export function stopSyncEngine() {
  syncLogger.info('Stopping sync engine');

  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  syncLogger.info('Sync engine stopped');
}

function handleOnline() {
  syncLogger.info('Network online - triggering sync');
  useUIStore.getState().setOnline(true);
  // Reset backoff when coming online
  consecutiveErrors = 0;
  currentSyncInterval = SYNC_INTERVAL;
  performSync();
}

function handleOffline() {
  syncLogger.info('Network offline');
  useUIStore.getState().setOnline(false);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    syncLogger.debug('Tab visible - checking for sync');
    performSync();
  }
}

// Check if user is authenticated and auth is not loading
function isAuthenticated(): boolean {
  const { isAuthenticated: authenticated, user, isLoading } = useAuthStore.getState();
  // Skip if auth is still loading
  if (isLoading) {
    return false;
  }
  // Also check if API client has a token
  return !!(authenticated && user && api.isAuthenticated());
}

// Main sync function
export async function performSync(): Promise<void> {
  const { isOnline, setSyncing, setPendingSyncCount } = useUIStore.getState();

  // Skip if not authenticated, offline, or already syncing
  if (!isAuthenticated()) {
    // Don't log this as an error - it's expected before login
    return;
  }

  if (!isOnline || isSyncing) {
    return;
  }

  isSyncing = true;
  setSyncing(true);
  emitSyncEvent('sync_start');

  let hadError = false;

  try {
    // Process sync queue first (push local changes)
    await processSyncQueue();

    // Then pull changes from server
    await pullChanges();

    // Update pending count
    const status = await getSyncStatus();
    setPendingSyncCount(status.totalPending);

    syncLogger.debug('Sync completed successfully');
    emitSyncEvent('sync_complete', { pendingCount: status.totalPending });
  } catch (error) {
    hadError = true;
    syncLogger.error('Sync failed', { error: (error as Error).message });
    emitSyncEvent('sync_error', { error: (error as Error).message });
  } finally {
    isSyncing = false;
    setSyncing(false);
    adjustSyncInterval(hadError);
  }
}

// Process pending items in sync queue with priority
async function processSyncQueue(): Promise<void> {
  // Get pending items sorted by priority (highest first) and timestamp
  const pendingItems = await db.syncQueue
    .where('status')
    .anyOf(['pending', 'failed'])
    .filter((item) => {
      // Only process items that are ready for retry
      if (item.status === 'failed' && item.nextRetryAt) {
        return new Date(item.nextRetryAt) <= new Date();
      }
      return true;
    })
    .toArray();

  if (pendingItems.length === 0) {
    return;
  }

  // Sort by priority (descending) and then by timestamp (ascending)
  pendingItems.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // Process in batches
  const batch = pendingItems.slice(0, MAX_BATCH_SIZE);
  syncLogger.debug(`Processing ${batch.length} items from sync queue`);

  // Group by table for efficient processing
  const groupedByTable = batch.reduce(
    (acc, item) => {
      if (!acc[item.table]) {
        acc[item.table] = [];
      }
      acc[item.table].push(item);
      return acc;
    },
    {} as Record<string, SyncQueueItem[]>
  );

  // Process each table group
  for (const [table, items] of Object.entries(groupedByTable)) {
    await processTableSync(table, items);
  }
}

// Process sync for a specific table
async function processTableSync(table: string, items: SyncQueueItem[]): Promise<void> {
  // Mark items as processing
  const itemIds = items.map((i) => i.id).filter(Boolean) as number[];
  await db.syncQueue.where('id').anyOf(itemIds).modify({ status: 'processing' });

  try {
    const response = await api.post<{
      success: boolean;
      processed: Array<{ clientId: string; serverId?: string; error?: string }>;
      conflicts: Array<{
        clientId: string;
        clientData: Record<string, unknown>;
        serverData: Record<string, unknown>;
        resolution: 'client_wins' | 'server_wins' | 'manual';
      }>;
    }>(`/api/sync/${table}`, {
      items: items.map((i) => ({
        clientId: i.recordId,
        operation: i.operation,
        data: i.data,
        timestamp: i.timestamp,
      })),
    }, {
      retries: 0, // Don't retry sync - will try again on next sync cycle
    });

    if (!response.data) {
      throw new Error('Empty response from sync endpoint');
    }

    // Process results
    for (const result of response.data.processed) {
      const item = items.find((i) => i.recordId === result.clientId);
      if (!item?.id) continue;

      if (result.error) {
        // Item failed - schedule retry
        await handleSyncFailure(item, result.error);
      } else {
        // Item synced successfully
        await db.syncQueue.delete(item.id);

        // Update local record with server ID if provided
        if (result.serverId && result.serverId !== result.clientId) {
          await updateLocalRecordId(table, result.clientId, result.serverId);
        }

        // Mark local record as synced
        await markRecordSynced(table, result.serverId || result.clientId);
      }
    }

    // Handle conflicts
    for (const conflict of response.data.conflicts) {
      await handleConflict(table, conflict);
    }
  } catch (error) {
    // Silently ignore auth errors - user may not be logged in yet
    if (error instanceof AuthenticationError) {
      syncLogger.debug(`Sync skipped for ${table} - not authenticated`);
      // Reset items back to pending (not failed) so they can sync after login
      await db.syncQueue.where('id').anyOf(itemIds).modify({ status: 'pending' });
      return;
    }

    syncLogger.error(`Failed to sync ${table}`, { error: error instanceof Error ? error.message : 'Unknown error' });

    // Mark all items in batch as failed
    for (const item of items) {
      if (item.id) {
        await handleSyncFailure(item, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
}

// Handle sync failure with exponential backoff
async function handleSyncFailure(item: SyncQueueItem, error: string): Promise<void> {
  if (!item.id) return;

  const newAttempts = item.attempts + 1;

  if (newAttempts >= item.maxAttempts) {
    // Max retries exceeded - mark as permanently failed
    await db.syncQueue.update(item.id, {
      status: 'failed',
      attempts: newAttempts,
      lastError: error,
      nextRetryAt: null, // No more retries
    });

    syncLogger.error(`Item ${item.recordId} permanently failed after ${newAttempts} attempts`);
    return;
  }

  // Calculate next retry with exponential backoff
  const backoffDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, newAttempts), MAX_RETRY_DELAY);
  const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
  const nextRetryAt = new Date(Date.now() + backoffDelay + jitter).toISOString();

  await db.syncQueue.update(item.id, {
    status: 'failed',
    attempts: newAttempts,
    lastError: error,
    nextRetryAt,
  });

  syncLogger.debug(`Item ${item.recordId} failed, retry ${newAttempts}/${item.maxAttempts} scheduled`, {
    nextRetryAt,
  });
}

// Handle sync conflict
async function handleConflict(
  table: string,
  conflict: {
    clientId: string;
    clientData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    resolution: 'client_wins' | 'server_wins' | 'manual';
  }
): Promise<void> {
  syncLogger.info(`Conflict detected for ${table}/${conflict.clientId}`, { resolution: conflict.resolution });

  switch (conflict.resolution) {
    case 'server_wins':
      // Apply server data locally
      await applyServerData(table, conflict.clientId, conflict.serverData);
      break;

    case 'client_wins':
      // Re-queue client data for sync
      const item = await db.syncQueue.where('recordId').equals(conflict.clientId).first();
      if (item?.id) {
        await db.syncQueue.update(item.id, {
          status: 'pending',
          attempts: 0,
          lastError: null,
          nextRetryAt: new Date().toISOString(),
        });
      }
      break;

    case 'manual':
      // Store conflict for manual resolution
      await markRecordConflict(table, conflict.clientId, conflict.serverData);
      break;
  }
}

// Pull changes from server
async function pullChanges(): Promise<void> {
  const lastSyncTime = localStorage.getItem('lastSyncTime');

  try {
    const response = await api.get<{
      serverTimestamp: string;
      changes: Array<{
        table: string;
        operation: 'create' | 'update' | 'delete';
        id: string;
        data?: Record<string, unknown>;
      }>;
    }>('/api/sync/pull',
      lastSyncTime ? { since: lastSyncTime } : undefined,
      { retries: 0 } // Don't retry sync - will try again on next sync cycle
    );

    if (!response.data) return;

    syncLogger.debug(`Pulling ${response.data.changes.length} changes from server`);

    // Apply changes in transaction
    await db.transaction('rw', [db.products, db.categories, db.customers, db.imeiInventory, db.productBatches, db.sales], async () => {
      for (const change of response.data!.changes) {
        await applyServerChange(change);
      }
    });

    // Update last sync time
    localStorage.setItem('lastSyncTime', response.data.serverTimestamp);
  } catch (error) {
    // Silently ignore auth errors - user may not be logged in yet
    if (error instanceof AuthenticationError) {
      syncLogger.debug('Pull skipped - not authenticated');
      return;
    }
    syncLogger.error('Pull failed', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// Apply a single change from server
async function applyServerChange(change: {
  table: string;
  operation: 'create' | 'update' | 'delete';
  id: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { table, operation, id, data } = change;

  const tableMap: Record<string, any> = {
    products: db.products,
    categories: db.categories,
    customers: db.customers,
    imei_inventory: db.imeiInventory,
    product_batches: db.productBatches,
    sales: db.sales,
    trade_ins: db.tradeIns,
    repair_orders: db.repairOrders,
  };

  const dbTable = tableMap[table];
  if (!dbTable) {
    syncLogger.warn(`Unknown table: ${table}`);
    return;
  }

  switch (operation) {
    case 'delete':
      await dbTable.delete(id);
      break;

    case 'create':
    case 'update':
      if (data) {
        // Check for local modifications
        const existing = await dbTable.get(id);
        if (existing && existing._syncStatus === SYNC_STATUS.PENDING) {
          // Local has pending changes - this is a conflict
          syncLogger.warn(`Conflict: local pending changes for ${table}/${id}`);
          // For now, server wins - could be configurable
        }

        await dbTable.put({
          ...data,
          id,
          _syncStatus: SYNC_STATUS.SYNCED,
          _serverSyncedAt: new Date().toISOString(),
        });
      }
      break;
  }
}

// Helper: Update local record ID (when server assigns different ID)
async function updateLocalRecordId(table: string, oldId: string, newId: string): Promise<void> {
  const tableMap: Record<string, any> = {
    products: db.products,
    categories: db.categories,
    customers: db.customers,
    imei_inventory: db.imeiInventory,
    product_batches: db.productBatches,
    sales: db.sales,
  };

  const dbTable = tableMap[table];
  if (!dbTable) return;

  const record = await dbTable.get(oldId);
  if (record) {
    await dbTable.delete(oldId);
    await dbTable.add({ ...record, id: newId });
  }
}

// Helper: Mark record as synced
async function markRecordSynced(table: string, id: string): Promise<void> {
  const tableMap: Record<string, any> = {
    products: db.products,
    categories: db.categories,
    customers: db.customers,
    imei_inventory: db.imeiInventory,
    product_batches: db.productBatches,
    sales: db.sales,
  };

  const dbTable = tableMap[table];
  if (!dbTable) return;

  await dbTable.update(id, {
    _syncStatus: SYNC_STATUS.SYNCED,
    _serverSyncedAt: new Date().toISOString(),
    _lastSyncError: null,
  });
}

// Helper: Apply server data to local record
async function applyServerData(
  table: string,
  id: string,
  serverData: Record<string, unknown>
): Promise<void> {
  const tableMap: Record<string, any> = {
    products: db.products,
    categories: db.categories,
    customers: db.customers,
    imei_inventory: db.imeiInventory,
    product_batches: db.productBatches,
    sales: db.sales,
  };

  const dbTable = tableMap[table];
  if (!dbTable) return;

  await dbTable.put({
    ...serverData,
    id,
    _syncStatus: SYNC_STATUS.SYNCED,
    _serverSyncedAt: new Date().toISOString(),
    _conflictData: null,
  });

  // Remove from sync queue
  await db.syncQueue.where('recordId').equals(id).delete();
}

// Helper: Mark record as having conflict
async function markRecordConflict(
  table: string,
  id: string,
  serverData: Record<string, unknown>
): Promise<void> {
  const tableMap: Record<string, any> = {
    products: db.products,
    categories: db.categories,
    customers: db.customers,
    imei_inventory: db.imeiInventory,
    product_batches: db.productBatches,
    sales: db.sales,
  };

  const dbTable = tableMap[table];
  if (!dbTable) return;

  await dbTable.update(id, {
    _syncStatus: SYNC_STATUS.CONFLICT,
    _conflictData: serverData,
  });
}

// Force sync a specific record
export async function forceSyncRecord(_table: string, id: string): Promise<boolean> {
  const { isOnline } = useUIStore.getState();

  if (!isOnline) {
    syncLogger.warn('Cannot force sync while offline');
    return false;
  }

  const item = await db.syncQueue.where('recordId').equals(id).first();
  if (item?.id) {
    await db.syncQueue.update(item.id, {
      status: 'pending',
      attempts: 0,
      nextRetryAt: new Date().toISOString(),
    });
    await performSync();
    return true;
  }

  return false;
}

// Retry all failed syncs
export async function retryFailedSyncs(): Promise<void> {
  const now = new Date().toISOString();

  await db.syncQueue
    .where('status')
    .equals('failed')
    .filter((item) => item.attempts < item.maxAttempts)
    .modify({
      status: 'pending',
      nextRetryAt: now,
    });

  await performSync();
}

// Get detailed sync status
export async function getDetailedSyncStatus() {
  const [pendingCount, failedCount, processingCount, queueItems] = await Promise.all([
    db.syncQueue.where('status').equals('pending').count(),
    db.syncQueue.where('status').equals('failed').count(),
    db.syncQueue.where('status').equals('processing').count(),
    db.syncQueue.orderBy('priority').reverse().limit(10).toArray(),
  ]);

  return {
    pending: pendingCount,
    failed: failedCount,
    processing: processingCount,
    total: pendingCount + failedCount + processingCount,
    recentItems: queueItems,
    lastSyncTime: localStorage.getItem('lastSyncTime'),
    isOnline: useUIStore.getState().isOnline,
  };
}

// Clear permanently failed items from sync queue
export async function clearPermanentlyFailedItems(): Promise<number> {
  const failedItems = await db.syncQueue
    .where('status')
    .equals('failed')
    .filter((item) => item.attempts >= item.maxAttempts)
    .toArray();

  const count = failedItems.length;
  if (count > 0) {
    const ids = failedItems.map((item) => item.id).filter((id): id is number => id !== undefined);
    await db.syncQueue.bulkDelete(ids);
    syncLogger.info(`Cleared ${count} permanently failed items from sync queue`);
  }

  return count;
}

// Clear a specific item from sync queue by record ID
export async function clearSyncItem(recordId: string): Promise<boolean> {
  const item = await db.syncQueue.where('recordId').equals(recordId).first();
  if (item?.id) {
    await db.syncQueue.delete(item.id);
    syncLogger.info(`Cleared sync item: ${recordId}`);
    return true;
  }
  return false;
}

// Reset failed items to retry (with reset attempts)
export async function resetFailedItems(): Promise<number> {
  const now = new Date().toISOString();

  const failedItems = await db.syncQueue
    .where('status')
    .equals('failed')
    .toArray();

  let resetCount = 0;
  for (const item of failedItems) {
    if (item.id) {
      await db.syncQueue.update(item.id, {
        status: 'pending',
        attempts: 0,
        nextRetryAt: now,
        lastError: null,
      });
      resetCount++;
    }
  }

  if (resetCount > 0) {
    syncLogger.info(`Reset ${resetCount} failed items for retry`);
    await performSync();
  }

  return resetCount;
}
