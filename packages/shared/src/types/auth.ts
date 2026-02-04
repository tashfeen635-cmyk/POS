import type { UserRole, StoreType } from '../constants/statuses';

export interface User {
  id: string;
  organizationId: string;
  storeId: string | null;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  logo: string | null;
  storeType: StoreType;
  settings: OrganizationSettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  currency: string;
  locale: string;
  taxRate: number;
  receiptHeader: string | null;
  receiptFooter: string | null;
  lowStockThreshold: number;
  expiryAlertDays: number;
}

export interface Store {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  organization: Organization;
  store: Store | null;
  tokens: AuthTokens;
}

export interface JWTPayload {
  userId: string;
  organizationId: string;
  storeId: string | null;
  role: UserRole;
  iat: number;
  exp: number;
}
