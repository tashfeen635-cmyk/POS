import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection';
import {
  users,
  refreshTokens,
  organizations,
  stores,
} from '@pos/db/schema';
import type {
  LoginInput,
  PinLoginInput,
  RegisterInput,
  JWTPayload,
  AuthSession,
  AuthTokens,
} from '@pos/shared';

const SALT_ROUNDS = 10;

export async function login(input: LoginInput): Promise<AuthSession> {
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account is disabled');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return createSession(user);
}

export async function loginWithPin(input: PinLoginInput): Promise<AuthSession> {
  const db = getDb();

  if (!input.userId) {
    throw new Error('User ID is required for PIN login');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) {
    throw new Error('Invalid user');
  }

  if (!user.isActive) {
    throw new Error('Account is disabled');
  }

  if (!user.pinHash) {
    throw new Error('PIN not set for this user');
  }

  const isValidPin = await bcrypt.compare(input.pin, user.pinHash);
  if (!isValidPin) {
    throw new Error('Invalid PIN');
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return createSession(user);
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const db = getDb();

  // Check if email already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: input.organizationName,
      email: input.email,
      phone: input.phone,
      storeType: input.storeType,
      settings: {
        currency: 'PKR',
        locale: 'en-PK',
        taxRate: 0,
        receiptHeader: null,
        receiptFooter: null,
        lowStockThreshold: 5,
        expiryAlertDays: 90,
      },
    })
    .returning();

  // Create default store
  const [store] = await db
    .insert(stores)
    .values({
      organizationId: org.id,
      name: 'Main Store',
      code: 'MAIN',
    })
    .returning();

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      storeId: store.id,
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      phone: input.phone,
      role: 'owner',
    })
    .returning();

  return createSession(user);
}

export async function refreshAccessToken(token: string): Promise<AuthTokens> {
  const db = getDb();

  // Find refresh token
  const [tokenRecord] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token))
    .limit(1);

  if (!tokenRecord) {
    throw new Error('Invalid refresh token');
  }

  if (new Date(tokenRecord.expiresAt) < new Date()) {
    // Delete expired token
    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord.id));
    throw new Error('Refresh token expired');
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenRecord.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new Error('User not found or disabled');
  }

  // Delete old refresh token
  await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord.id));

  // Generate new tokens
  return generateTokens(user);
}

export async function logout(userId: string, refreshToken?: string): Promise<void> {
  const db = getDb();

  if (refreshToken) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  } else {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}

export async function setPin(userId: string, pin: string): Promise<void> {
  const db = getDb();
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

  await db
    .update(users)
    .set({ pinHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

async function createSession(user: typeof users.$inferSelect): Promise<AuthSession> {
  const db = getDb();

  // Get organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  if (!org) {
    throw new Error('Organization not found');
  }

  // Get store if assigned
  let store = null;
  if (user.storeId) {
    [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, user.storeId))
      .limit(1);
  }

  const tokens = await generateTokens(user);

  return {
    user: {
      id: user.id,
      organizationId: user.organizationId,
      storeId: user.storeId,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role as any,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    organization: {
      id: org.id,
      name: org.name,
      email: org.email,
      phone: org.phone,
      address: org.address,
      city: org.city,
      logo: org.logo,
      storeType: org.storeType as any,
      settings: org.settings as any,
      isActive: org.isActive,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    },
    store: store
      ? {
          id: store.id,
          organizationId: store.organizationId,
          name: store.name,
          code: store.code,
          address: store.address,
          phone: store.phone,
          isActive: store.isActive,
          createdAt: store.createdAt.toISOString(),
          updatedAt: store.updatedAt.toISOString(),
        }
      : null,
    tokens,
  };
}

async function generateTokens(user: typeof users.$inferSelect): Promise<AuthTokens> {
  const db = getDb();

  const jwtSecret = process.env.JWT_SECRET!;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    organizationId: user.organizationId,
    storeId: user.storeId,
    role: user.role as any,
  };

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn,
  });

  const refreshToken = nanoid(64);

  // Calculate refresh token expiry
  const refreshExpiry = new Date();
  const days = parseInt(refreshExpiresIn) || 7;
  refreshExpiry.setDate(refreshExpiry.getDate() + days);

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: refreshExpiry,
  });

  // Parse expiresIn to seconds
  let expiresInSeconds = 900; // default 15 minutes
  if (expiresIn.endsWith('m')) {
    expiresInSeconds = parseInt(expiresIn) * 60;
  } else if (expiresIn.endsWith('h')) {
    expiresInSeconds = parseInt(expiresIn) * 3600;
  } else if (expiresIn.endsWith('d')) {
    expiresInSeconds = parseInt(expiresIn) * 86400;
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: expiresInSeconds,
  };
}

export async function getUsersForPinLogin(organizationId: string) {
  const db = getDb();

  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      hasPin: users.pinHash,
    })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.isActive, true)));

  return userList.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    hasPin: !!u.hasPin,
  }));
}
