import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  createProductSchema,
  updateProductSchema,
  productFilterSchema,
  createCategorySchema,
  updateCategorySchema,
} from '@pos/shared/schemas';
import * as productService from '../services/product.service';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, getTenant } from '../middleware/tenant';

const products = new Hono();

// Apply auth and tenant middleware to all routes
products.use('*', authMiddleware, tenantMiddleware);

// Get products with filters
products.get('/', zValidator('query', productFilterSchema), async (c) => {
  const tenant = getTenant(c);
  const filters = c.req.valid('query');
  const result = await productService.getProducts(tenant.organizationId, filters);
  return c.json({ success: true, ...result });
});

// Get product by ID
products.get('/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const product = await productService.getProductById(tenant.organizationId, id);

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      404
    );
  }

  return c.json({ success: true, data: product });
});

// Get product by barcode
products.get('/barcode/:barcode', async (c) => {
  const tenant = getTenant(c);
  const { barcode } = c.req.param();
  const product = await productService.getProductByBarcode(tenant.organizationId, barcode);

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      404
    );
  }

  return c.json({ success: true, data: product });
});

// Create product
products.post('/', zValidator('json', createProductSchema), async (c) => {
  const tenant = getTenant(c);
  const input = c.req.valid('json');
  const product = await productService.createProduct(tenant.organizationId, input);
  return c.json({ success: true, data: product }, 201);
});

// Update product
products.put('/:id', zValidator('json', updateProductSchema), async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const input = c.req.valid('json');
  const product = await productService.updateProduct(tenant.organizationId, id, input);

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      404
    );
  }

  return c.json({ success: true, data: product });
});

// Delete product (soft delete)
products.delete('/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const product = await productService.deleteProduct(tenant.organizationId, id);

  if (!product) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      404
    );
  }

  return c.json({ success: true, data: { message: 'Product deleted' } });
});

// Get low stock products
products.get('/alerts/low-stock', async (c) => {
  const tenant = getTenant(c);
  const limit = parseInt(c.req.query('limit') || '10');
  const products = await productService.getLowStockProducts(tenant.organizationId, limit);
  return c.json({ success: true, data: products });
});

// Categories
products.get('/categories/list', async (c) => {
  const tenant = getTenant(c);
  const categories = await productService.getCategories(tenant.organizationId);
  return c.json({ success: true, data: categories });
});

products.post('/categories', zValidator('json', createCategorySchema), async (c) => {
  const tenant = getTenant(c);
  const input = c.req.valid('json');
  const category = await productService.createCategory(tenant.organizationId, input);
  return c.json({ success: true, data: category }, 201);
});

products.put('/categories/:id', zValidator('json', updateCategorySchema), async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const input = c.req.valid('json');
  const category = await productService.updateCategory(tenant.organizationId, id, input);

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
      404
    );
  }

  return c.json({ success: true, data: category });
});

products.delete('/categories/:id', async (c) => {
  const tenant = getTenant(c);
  const { id } = c.req.param();
  const category = await productService.deleteCategory(tenant.organizationId, id);

  if (!category) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
      404
    );
  }

  return c.json({ success: true, data: { message: 'Category deleted' } });
});

export default products;
