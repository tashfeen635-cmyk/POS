import type { Context, Next } from 'hono';
import type { JWTPayload } from '@pos/shared';

export interface TenantContext {
  organizationId: string;
  storeId: string | null;
}

export async function tenantMiddleware(c: Context, next: Next) {
  const user = c.get('user') as JWTPayload;

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      },
      401
    );
  }

  c.set('tenant', {
    organizationId: user.organizationId,
    storeId: user.storeId,
  } as TenantContext);

  await next();
}

export function getTenant(c: Context): TenantContext {
  return c.get('tenant') as TenantContext;
}
