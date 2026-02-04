import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const pinLoginSchema = z.object({
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d+$/, 'PIN must contain only numbers'),
  userId: z.string().uuid().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  organizationName: z.string().min(2, 'Organization name is required'),
  storeType: z.enum(['mobile_shop', 'medical_store', 'general']),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const setPinSchema = z.object({
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d+$/, 'PIN must contain only numbers'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PinLoginInput = z.infer<typeof pinLoginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
