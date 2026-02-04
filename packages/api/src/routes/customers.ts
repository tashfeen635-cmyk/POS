import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFilterSchema,
} from '@pos/shared/schemas';
import * as customerService from '../services/customer.service';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, getTenant } from '../middleware/tenant';

const customers = new Hono();

// Apply auth and tenant middleware to all routes
customers.use('*', authMiddleware, tenantMiddleware);

// Get customers with filters
customers.get('/', zValidator('query', customerFilterSchema), async (c) => {
  const tenant = getTenant(c);
  const filters = c.req.valid('query');
  const result = await customerService.getCustomers(tenant.organizationId, filters);
  return c.json({ success: true, ...result });
});

// Get customer by ID
customers.get('/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const customer = await customerService.getCustomerById(tenant.organizationId, id);

  if (!customer) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
      404
    );
  }

  return c.json({ success: true, data: customer });
});

// Get customer by phone
customers.get('/phone/:phone', async (c) => {
  const tenant = getTenant(c);
  const { phone } = c.req.param();
  const customer = await customerService.getCustomerByPhone(tenant.organizationId, phone);

  if (!customer) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
      404
    );
  }

  return c.json({ success: true, data: customer });
});

// Create customer
customers.post('/', zValidator('json', createCustomerSchema), async (c) => {
  const tenant = getTenant(c);
  const input = c.req.valid('json');
  const customer = await customerService.createCustomer(tenant.organizationId, input);
  return c.json({ success: true, data: customer }, 201);
});

// Update customer
customers.put('/:id', zValidator('json', updateCustomerSchema), async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const input = c.req.valid('json');
  const customer = await customerService.updateCustomer(tenant.organizationId, id, input);

  if (!customer) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
      404
    );
  }

  return c.json({ success: true, data: customer });
});

// Delete customer (soft delete)
customers.delete('/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const customer = await customerService.deleteCustomer(tenant.organizationId, id);

  if (!customer) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
      404
    );
  }

  return c.json({ success: true, data: { message: 'Customer deleted' } });
});

// Get customers with credit balance
customers.get('/reports/credit', async (c) => {
  const tenant = getTenant(c);
  const customers = await customerService.getCustomersWithCredit(tenant.organizationId);
  return c.json({ success: true, data: customers });
});

export default customers;
