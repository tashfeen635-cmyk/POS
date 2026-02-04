import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { syncRequestSchema } from '@pos/shared/schemas';
import * as syncService from '../services/sync.service';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, getTenant } from '../middleware/tenant';
import type { JWTPayload } from '@pos/shared';

const sync = new Hono();

// Apply auth and tenant middleware to all routes
sync.use('*', authMiddleware, tenantMiddleware);

// Schema for table sync items
const tableSyncItemSchema = z.object({
  clientId: z.string(),
  operation: z.enum(['create', 'update', 'delete']),
  data: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});

const tableSyncSchema = z.object({
  items: z.array(tableSyncItemSchema),
});

// Pull changes from server (GET /api/sync/pull)
sync.get('/pull', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }

  const since = c.req.query('since');
  const limit = parseInt(c.req.query('limit') || '500');
  const cursor = c.req.query('cursor');

  try {
    const result = await syncService.pullChanges(
      tenant.organizationId,
      tenant.storeId,
      since || null,
      { limit, cursor }
    );

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PULL_FAILED',
          message: error instanceof Error ? error.message : 'Pull failed',
        },
      },
      500
    );
  }
});

// Push changes for a specific table (POST /api/sync/:table)
sync.post('/:table', zValidator('json', tableSyncSchema), async (c) => {
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

  const table = c.req.param('table');
  const input = c.req.valid('json');

  try {
    const result = await syncService.pushTableChanges(
      tenant.organizationId,
      tenant.storeId,
      user.userId,
      clientId,
      table,
      input.items
    );

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PUSH_FAILED',
          message: error instanceof Error ? error.message : 'Push failed',
        },
      },
      500
    );
  }
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
