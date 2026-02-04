import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { errorHandler } from './middleware/error-handler';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import inventoryRoutes from './routes/inventory';
import customerRoutes from './routes/customers';
import saleRoutes from './routes/sales';
import syncRoutes from './routes/sync';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow requests from localhost during development
      if (!origin) return '*';
      if (origin.startsWith('http://localhost:')) return origin;
      if (origin.startsWith('https://localhost:')) return origin;
      // In production, you would check against allowed origins
      return origin;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Client-ID'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);
app.use('*', errorHandler);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'POS API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/products', productRoutes);
app.route('/api/inventory', inventoryRoutes);
app.route('/api/customers', customerRoutes);
app.route('/api/sales', saleRoutes);
app.route('/api/sync', syncRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    },
    404
  );
});

// Start server
const port = parseInt(process.env.API_PORT || '3000');
const host = process.env.API_HOST || 'localhost';

console.log(`Starting POS API server...`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    console.log(`Server running at http://${host}:${info.port}`);
  }
);

export default app;
