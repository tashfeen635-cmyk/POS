import type { Context, Next } from 'hono';
import { ZodError } from 'zod';
import {
  AppError,
  ValidationError,
  DuplicateError,
  DatabaseError,
  ReferenceError,
  isUniqueConstraintError,
  isForeignKeyError,
  isConnectionError,
} from '../errors';

// Structured logger for errors
interface ErrorLog {
  timestamp: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  method: string;
  path: string;
  errorCode: string;
  errorMessage: string;
  stack?: string;
  details?: unknown;
}

function logError(c: Context, errorLog: ErrorLog): void {
  // In production, this could be sent to a logging service
  console.error(JSON.stringify(errorLog, null, 2));
}

function getRequestContext(c: Context): { requestId?: string; userId?: string; tenantId?: string } {
  return {
    requestId: c.req.header('X-Request-ID'),
    userId: c.get('userId'),
    tenantId: c.get('tenantId'),
  };
}

function createErrorLog(
  c: Context,
  errorCode: string,
  errorMessage: string,
  stack?: string,
  details?: unknown
): ErrorLog {
  const { requestId, userId, tenantId } = getRequestContext(c);
  return {
    timestamp: new Date().toISOString(),
    requestId,
    userId,
    tenantId,
    method: c.req.method,
    path: c.req.path,
    errorCode,
    errorMessage,
    stack,
    details,
  };
}

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    // Handle custom AppError instances
    if (error instanceof AppError) {
      // Log internal details for database errors
      if (error instanceof DatabaseError) {
        logError(
          c,
          createErrorLog(c, error.code, error.getInternalMessage(), error.stack)
        );
      } else {
        logError(c, createErrorLog(c, error.code, error.message, error.stack));
      }

      // Return appropriate response
      const response: Record<string, unknown> = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };

      // Add details for validation errors
      if (error instanceof ValidationError && Object.keys(error.details).length > 0) {
        (response.error as Record<string, unknown>).details = error.details;
      }

      return c.json(response, error.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500);
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));

      logError(
        c,
        createErrorLog(c, 'VALIDATION_ERROR', 'Validation failed', undefined, details)
      );

      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details,
          },
        },
        400
      );
    }

    // Handle database-specific errors by detecting patterns
    if (error instanceof Error) {
      // Check for unique constraint violations
      if (isUniqueConstraintError(error)) {
        logError(c, createErrorLog(c, 'DUPLICATE_ERROR', error.message, error.stack));
        return c.json(
          {
            success: false,
            error: {
              code: 'DUPLICATE_ERROR',
              message: 'A record with this value already exists',
            },
          },
          409
        );
      }

      // Check for foreign key violations
      if (isForeignKeyError(error)) {
        logError(c, createErrorLog(c, 'REFERENCE_ERROR', error.message, error.stack));
        return c.json(
          {
            success: false,
            error: {
              code: 'REFERENCE_ERROR',
              message: 'Referenced record does not exist',
            },
          },
          400
        );
      }

      // Check for connection errors
      if (isConnectionError(error)) {
        logError(c, createErrorLog(c, 'DATABASE_ERROR', error.message, error.stack));
        return c.json(
          {
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Service temporarily unavailable, please try again',
            },
          },
          503
        );
      }
    }

    // Generic error handling - don't expose internal details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logError(c, createErrorLog(c, 'INTERNAL_ERROR', errorMessage, errorStack));

    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500
    );
  }
}
