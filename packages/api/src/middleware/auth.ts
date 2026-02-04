import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@pos/shared';

export interface AuthContext {
  user: JWTPayload;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
      },
      401
    );
  }

  const token = authHeader.substring(7);

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = jwt.verify(token, secret) as JWTPayload;
    c.set('user', payload);

    await next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return c.json(
        {
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
        },
        401
      );
    }

    return c.json(
      {
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
      },
      401
    );
  }
}

export function requireRoles(...roles: string[]) {
  return async (c: Context, next: Next) => {
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

    if (!roles.includes(user.role)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        },
        403
      );
    }

    await next();
  };
}
