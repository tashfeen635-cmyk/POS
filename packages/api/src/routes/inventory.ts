import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createIMEISchema,
  updateIMEISchema,
  imeiFilterSchema,
  createBatchSchema,
  updateBatchSchema,
  batchFilterSchema,
  stockAdjustmentSchema,
} from '@pos/shared/schemas';
import * as inventoryService from '../services/inventory.service';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, getTenant } from '../middleware/tenant';
import type { JWTPayload } from '@pos/shared';

const inventory = new Hono();

// Apply auth and tenant middleware to all routes
inventory.use('*', authMiddleware, tenantMiddleware);

// IMEI Inventory Routes
inventory.get('/imei', zValidator('query', imeiFilterSchema), async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const filters = c.req.valid('query');
  const result = await inventoryService.getIMEIInventory(
    tenant.organizationId,
    tenant.storeId,
    filters
  );
  return c.json({ success: true, ...result });
});

inventory.get('/imei/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const item = await inventoryService.getIMEIById(tenant.organizationId, id);

  if (!item) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'IMEI not found' } },
      404
    );
  }

  return c.json({ success: true, data: item });
});

inventory.get('/imei/search/:imei', async (c) => {
  const tenant = getTenant(c);
  const { imei } = c.req.param();
  const item = await inventoryService.getIMEIByNumber(tenant.organizationId, imei);

  if (!item) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'IMEI not found' } },
      404
    );
  }

  return c.json({ success: true, data: item });
});

inventory.post('/imei', zValidator('json', createIMEISchema), async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const input = c.req.valid('json');
  const item = await inventoryService.createIMEI(tenant.organizationId, tenant.storeId, input);
  return c.json({ success: true, data: item }, 201);
});

inventory.put('/imei/:id', zValidator('json', updateIMEISchema), async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const input = c.req.valid('json');
  const item = await inventoryService.updateIMEI(tenant.organizationId, id, input);

  if (!item) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'IMEI not found' } },
      404
    );
  }

  return c.json({ success: true, data: item });
});

inventory.get('/imei/available/:productId', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const { productId } = c.req.param();
  const items = await inventoryService.getAvailableIMEIs(
    tenant.organizationId,
    tenant.storeId,
    productId
  );
  return c.json({ success: true, data: items });
});

// Batch Inventory Routes
inventory.get('/batches', zValidator('query', batchFilterSchema), async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const filters = c.req.valid('query');
  const result = await inventoryService.getBatches(
    tenant.organizationId,
    tenant.storeId,
    filters
  );
  return c.json({ success: true, ...result });
});

inventory.post('/batches', zValidator('json', createBatchSchema), async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const input = c.req.valid('json');
  const batch = await inventoryService.createBatch(tenant.organizationId, tenant.storeId, input);
  return c.json({ success: true, data: batch }, 201);
});

inventory.put('/batches/:id', zValidator('json', updateBatchSchema), async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const input = c.req.valid('json');
  const batch = await inventoryService.updateBatch(tenant.organizationId, id, input);

  if (!batch) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Batch not found' } },
      404
    );
  }

  return c.json({ success: true, data: batch });
});

inventory.get('/batches/available/:productId', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const { productId } = c.req.param();
  const batches = await inventoryService.getAvailableBatches(
    tenant.organizationId,
    tenant.storeId,
    productId
  );
  return c.json({ success: true, data: batches });
});

// Stock Adjustment
inventory.post('/adjust', zValidator('json', stockAdjustmentSchema), async (c) => {
  const tenant = getTenant(c);
  const user = c.get('user') as JWTPayload;
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const input = c.req.valid('json');

  try {
    const entry = await inventoryService.adjustStock(
      tenant.organizationId,
      tenant.storeId,
      user.userId,
      input
    );
    return c.json({ success: true, data: entry }, 201);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'ADJUSTMENT_FAILED',
          message: error instanceof Error ? error.message : 'Stock adjustment failed',
        },
      },
      400
    );
  }
});

// Expiry Alerts
inventory.get('/alerts/expiry', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const days = parseInt(c.req.query('days') || '90');
  const alerts = await inventoryService.getExpiryAlerts(
    tenant.organizationId,
    tenant.storeId,
    days
  );
  return c.json({ success: true, data: alerts });
});

export default inventory;
