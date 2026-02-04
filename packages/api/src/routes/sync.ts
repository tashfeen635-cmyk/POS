import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { syncRequestSchema } from '@pos/shared/schemas';
import * as syncService from '../services/sync.service';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, getTenant } from '../middleware/tenant';
import type { JWTPayload } from '@pos/shared';

const sync = new Hono();

// Apply auth and tenant middleware to all routes
sync.use('*', authMiddleware, tenantMiddleware);

// Pull changes from server (GET /api/sync/pull) - MVP stub
sync.get('/pull', async (c) => {
  return c.json({
    success: true,
    data: {
      serverTimestamp: new Date().toISOString(),
      changes: [],
    },
  });
});

// Push changes for a specific table (POST /api/sync/:table) - MVP stub
sync.post('/:table', async (c) => {
  const body = await c.req.json().catch(() => ({ items: [] }));
  const items = body.items || [];

  return c.json({
    success: true,
    data: {
      success: true,
      processed: items.map((item: any) => ({
        clientId: item.clientId,
        serverId: item.clientId,
      })),
      conflicts: [],
    },
  });
});

// Process sync (legacy endpoint)
sync.post('/', zValidator('json', syncRequestSchema), async (c) => {
  const tenant = getTenant(c);
  const user = c.get('user') as JWTPayload;
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }

  const clientId = c.req.header('X-Client-ID');
  if (!clientId) {
    return c.json(
      { success: false, error: { code: 'MISSING_CLIENT_ID', message: 'X-Client-ID header required' } },
      400
    );
  }

  const input = c.req.valid('json');

  try {
    const result = await syncService.processSync(
      tenant.organizationId,
      tenant.storeId,
      user.userId,
      clientId,
      input
    );
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Sync failed',
        },
      },
      500
    );
  }
});

// Get last sync time
sync.get('/last', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }

  const clientId = c.req.header('X-Client-ID');
  if (!clientId) {
    return c.json(
      { success: false, error: { code: 'MISSING_CLIENT_ID', message: 'X-Client-ID header required' } },
      400
    );
  }

  const lastSyncTime = await syncService.getLastSyncTime(
    tenant.organizationId,
    tenant.storeId,
    clientId
  );

  return c.json({ success: true, data: { lastSyncTime } });
});

export default sync;
