// App Initialization - Sets up all production systems
import { logger } from './logging/logger';
import { scheduler } from './jobs/scheduler';
import { startSyncEngine, stopSyncEngine, performSync, retryFailedSyncs } from './sync/engine';
import { runExpiryChecks, blockExpiredBatches } from './services/medical-store';
import { processPendingReceipts } from './print/receipt';
import { db, getSyncStatus } from './db';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from './api/client';

let initialized = false;

// Initialize all app systems
export async function initializeApp(): Promise<void> {
  if (initialized) {
    logger.warn('App already initialized');
    return;
  }

  logger.info('Initializing POS application...');
  const startTime = Date.now();

  try {
    // 1. Initialize database
    await initializeDatabase();

    // 2. Setup network status monitoring
    setupNetworkMonitoring();

    // 3. Setup auth callbacks
    setupAuthCallbacks();

    // 4. Register background jobs
    registerBackgroundJobs();

    // 5. Start sync engine
    await startSyncEngine();

    // 6. Start job scheduler
    scheduler.start();

    // 7. Run initial checks
    await runInitialChecks();

    initialized = true;

    const duration = Date.now() - startTime;
    logger.info('POS application initialized', { duration });
  } catch (error) {
    logger.error('App initialization failed', { error: (error as Error).message });
    throw error;
  }
}

// Cleanup on app shutdown
export async function shutdownApp(): Promise<void> {
  logger.info('Shutting down POS application...');

  // Stop scheduler
  scheduler.stop();

  // Stop sync engine
  stopSyncEngine();

  // Flush logs
  await logger.flush();

  initialized = false;
  logger.info('POS application shutdown complete');
}

// Initialize IndexedDB
async function initializeDatabase(): Promise<void> {
  logger.debug('Initializing database...');

  // Open database (creates tables if needed)
  await db.open();

  // Load client ID
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem('clientId', clientId);
    logger.info('Generated new client ID', { clientId });
  }

  // Check sync status
  const status = await getSyncStatus();
  useUIStore.getState().setPendingSyncCount(status.totalPending);

  logger.debug('Database initialized', { pendingSync: status.totalPending });
}

// Setup network status monitoring
function setupNetworkMonitoring(): void {
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    useUIStore.getState().setOnline(isOnline);
    logger.info(`Network status: ${isOnline ? 'online' : 'offline'}`);
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Set initial status
  updateOnlineStatus();
}

// Setup auth callbacks
function setupAuthCallbacks(): void {
  api.setOnUnauthorized(() => {
    logger.info('Session expired, logging out');
    useAuthStore.getState().logout();
  });
}

// Register background jobs
function registerBackgroundJobs(): void {
  logger.debug('Registering background jobs...');

  // Sync job - runs every 30 seconds
  scheduler.register(
    'sync',
    'Data Sync',
    async () => {
      await performSync();
    },
    30 * 1000, // 30 seconds
    { priority: 'high', runImmediately: false }
  );

  // Retry failed syncs - runs every 5 minutes
  scheduler.register(
    'retry-failed-sync',
    'Retry Failed Sync',
    async () => {
      await retryFailedSyncs();
    },
    5 * 60 * 1000, // 5 minutes
    { priority: 'normal', runImmediately: false }
  );

  // Expiry check - runs every hour
  scheduler.register(
    'expiry-check',
    'Expiry Check',
    async () => {
      await runExpiryChecks();
    },
    60 * 60 * 1000, // 1 hour
    { priority: 'normal', runImmediately: false }
  );

  // Block expired batches - runs every 6 hours
  scheduler.register(
    'block-expired',
    'Block Expired Batches',
    async () => {
      await blockExpiredBatches();
    },
    6 * 60 * 60 * 1000, // 6 hours
    { priority: 'low', runImmediately: false }
  );

  // Process pending receipts - runs every minute
  scheduler.register(
    'pending-receipts',
    'Process Pending Receipts',
    async () => {
      const printed = await processPendingReceipts();
      if (printed > 0) {
        logger.info(`Printed ${printed} pending receipts`);
      }
    },
    60 * 1000, // 1 minute
    { priority: 'normal', runImmediately: false }
  );

  // Health check - runs every 2 minutes
  scheduler.register(
    'health-check',
    'API Health Check',
    async () => {
      const healthy = await api.healthCheck();
      if (!healthy && navigator.onLine) {
        logger.warn('API health check failed');
      }
    },
    2 * 60 * 1000, // 2 minutes
    { priority: 'low', runImmediately: false }
  );

  // Log flush - runs every 30 seconds
  scheduler.register(
    'log-flush',
    'Flush Logs',
    async () => {
      await logger.flush();
    },
    30 * 1000,
    { priority: 'low', runImmediately: false }
  );

  logger.debug('Background jobs registered', {
    count: scheduler.getAllStatus().length,
  });
}

// Run initial checks
async function runInitialChecks(): Promise<void> {
  logger.debug('Running initial checks...');

  // Check for expired batches (local only, no auth needed)
  try {
    const blocked = await blockExpiredBatches();
    if (blocked > 0) {
      logger.warn(`Blocked ${blocked} expired batches on startup`);
    }
  } catch (error) {
    logger.error('Expiry check failed', { error: (error as Error).message });
  }

  // Process any pending receipts (local only, no auth needed)
  try {
    const printed = await processPendingReceipts();
    if (printed > 0) {
      logger.info(`Printed ${printed} pending receipts on startup`);
    }
  } catch (error) {
    logger.error('Receipt processing failed', { error: (error as Error).message });
  }

  // Initial sync - only if authenticated
  // The sync engine will check auth internally, so this won't spam 401 errors
  try {
    await performSync();
  } catch (error) {
    // Silently ignore sync errors on startup - user may not be logged in
    logger.debug('Initial sync skipped or failed', { error: (error as Error).message });
  }
}

// Export hooks for React components
export function useAppInit() {
  return {
    initialize: initializeApp,
    shutdown: shutdownApp,
    isInitialized: initialized,
  };
}

// Service worker registration
export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available
              logger.info('New app version available');
              // Could notify user to refresh
            }
          });
        }
      });

      logger.info('Service worker registered');
    } catch (error) {
      logger.error('Service worker registration failed', { error: (error as Error).message });
    }
  }
}
