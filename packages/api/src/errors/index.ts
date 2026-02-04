// Custom error classes for structured error handling

// Base application error
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, statusCode: number, isOperational = true) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation errors (400)
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

// Authentication errors (401)
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

// Authorization errors (403)
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

// Not found errors (404)
export class NotFoundError extends AppError {
  public readonly resource: string;

  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.resource = resource;
  }
}

// Duplicate/conflict errors (409)
export class DuplicateError extends AppError {
  public readonly field?: string;

  constructor(message: string = 'A record with this value already exists', field?: string) {
    super(message, 'DUPLICATE_ERROR', 409);
    this.field = field;
  }
}

// Database errors (500)
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    // Always use a generic message externally, log details internally
    super('A database error occurred', 'DATABASE_ERROR', 500);
    // Store original message for logging
    (this as any).originalMessage = message;
  }

  getInternalMessage(): string {
    return (this as any).originalMessage || this.message;
  }
}

// Foreign key constraint errors (400)
export class ReferenceError extends AppError {
  constructor(message: string = 'Referenced record does not exist') {
    super(message, 'REFERENCE_ERROR', 400);
  }
}

// Insufficient stock errors (400)
export class InsufficientStockError extends AppError {
  public readonly productId: string;
  public readonly requested: number;
  public readonly available: number;

  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock: requested ${requested}, available ${available}`,
      'INSUFFICIENT_STOCK',
      400
    );
    this.productId = productId;
    this.requested = requested;
    this.available = available;
  }
}

// Conflict during sync (409)
export class SyncConflictError extends AppError {
  public readonly conflicts: Array<{
    table: string;
    recordId: string;
    serverVersion: number;
    clientVersion: number;
  }>;

  constructor(
    conflicts: Array<{ table: string; recordId: string; serverVersion: number; clientVersion: number }>
  ) {
    super('Sync conflict detected', 'SYNC_CONFLICT', 409);
    this.conflicts = conflicts;
  }
}

// Rate limit errors (429)
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Too many requests, please try again later', 'RATE_LIMIT', 429);
    this.retryAfter = retryAfter;
  }
}

// Check if error is a Postgres unique constraint violation
export function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('unique constraint') ||
      msg.includes('duplicate key') ||
      msg.includes('unique_violation') ||
      (error as any).code === '23505' // PostgreSQL unique violation code
    );
  }
  return false;
}

// Check if error is a Postgres foreign key constraint violation
export function isForeignKeyError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('foreign key') ||
      msg.includes('violates foreign key constraint') ||
      (error as any).code === '23503' // PostgreSQL foreign key violation code
    );
  }
  return false;
}

// Check if error is a database connection error
export function isConnectionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('connection') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout') ||
      msg.includes('etimedout')
    );
  }
  return false;
}
