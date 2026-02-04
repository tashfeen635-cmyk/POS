import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  loginSchema,
  pinLoginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  setPinSchema,
} from '@pos/shared/schemas';
import * as authService from '../services/auth.service';
import { authMiddleware } from '../middleware/auth';
import type { JWTPayload } from '@pos/shared';

const auth = new Hono();

// Login with email/password
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const session = await authService.login(input);
    return c.json({ success: true, data: session });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
      },
      401
    );
  }
});

// Login with PIN
auth.post('/login/pin', zValidator('json', pinLoginSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const session = await authService.loginWithPin(input);
    return c.json({ success: true, data: session });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: error instanceof Error ? error.message : 'Authentication failed',
        },
      },
      401
    );
  }
});

// Register new organization
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  try {
    const input = c.req.valid('json');
    const session = await authService.register(input);
    return c.json({ success: true, data: session }, 201);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Registration failed',
        },
      },
      400
    );
  }
});

// Refresh access token
auth.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  try {
    const { refreshToken } = c.req.valid('json');
    const tokens = await authService.refreshAccessToken(refreshToken);
    return c.json({ success: true, data: tokens });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: error instanceof Error ? error.message : 'Token refresh failed',
        },
      },
      401
    );
  }
});

// Logout
auth.post('/logout', authMiddleware, async (c) => {
  const user = c.get('user') as JWTPayload;
  const body = await c.req.json().catch(() => ({}));
  await authService.logout(user.userId, body.refreshToken);
  return c.json({ success: true, data: { message: 'Logged out successfully' } });
});

// Get current user
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user') as JWTPayload;
  return c.json({ success: true, data: user });
});

// Change password
auth.post(
  '/change-password',
  authMiddleware,
  zValidator('json', changePasswordSchema),
  async (c) => {
    try {
      const user = c.get('user') as JWTPayload;
      const input = c.req.valid('json');
      await authService.changePassword(user.userId, input.currentPassword, input.newPassword);
      return c.json({ success: true, data: { message: 'Password changed successfully' } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: 'PASSWORD_CHANGE_FAILED',
            message: error instanceof Error ? error.message : 'Password change failed',
          },
        },
        400
      );
    }
  }
);

// Set/Update PIN
auth.post('/set-pin', authMiddleware, zValidator('json', setPinSchema), async (c) => {
  const user = c.get('user') as JWTPayload;
  const { pin } = c.req.valid('json');
  await authService.setPin(user.userId, pin);
  return c.json({ success: true, data: { message: 'PIN set successfully' } });
});

// Get users for PIN login (public endpoint for organization)
auth.get('/users/:organizationId', async (c) => {
  const { organizationId } = c.req.param();
  const users = await authService.getUsersForPinLogin(organizationId);
  return c.json({ success: true, data: users });
});

export default auth;
