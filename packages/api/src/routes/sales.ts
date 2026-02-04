import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createSaleSchema, saleFilterSchema } from '@pos/shared/schemas';
import * as saleService from '../services/sale.service';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, getTenant } from '../middleware/tenant';
import type { JWTPayload } from '@pos/shared';

const sales = new Hono();

// Apply auth and tenant middleware to all routes
sales.use('*', authMiddleware, tenantMiddleware);

// Get sales with filters
sales.get('/', zValidator('query', saleFilterSchema), async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const filters = c.req.valid('query');
  const result = await saleService.getSales(tenant.organizationId, tenant.storeId, filters);
  return c.json({ success: true, ...result });
});

// Get sale by ID
sales.get('/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const sale = await saleService.getSaleById(tenant.organizationId, id);

  if (!sale) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Sale not found' } },
      404
    );
  }

  return c.json({ success: true, data: sale });
});

// Create sale
sales.post('/', zValidator('json', createSaleSchema), async (c) => {
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
    const sale = await saleService.createSale(
      tenant.organizationId,
      tenant.storeId,
      user.userId,
      input
    );
    return c.json({ success: true, data: sale }, 201);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SALE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create sale',
        },
      },
      400
    );
  }
});

// Today's sales summary
sales.get('/reports/today', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const summary = await saleService.getTodaySalesSummary(tenant.organizationId, tenant.storeId);
  return c.json({ success: true, data: summary });
});

// Recent sales
sales.get('/reports/recent', async (c) => {
  const tenant = getTenant(c);
  if (!tenant.storeId) {
    return c.json(
      { success: false, error: { code: 'NO_STORE', message: 'Store not assigned' } },
      400
    );
  }
  const limit = parseInt(c.req.query('limit') || '10');
  const sales = await saleService.getRecentSales(tenant.organizationId, tenant.storeId, limit);
  return c.json({ success: true, data: sales });
});

export default sales;
