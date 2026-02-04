import type { Context, Next } from 'hono';
import { ZodError } from 'zod';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Unhandled error:', error);

    if (error instanceof ZodError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors,
          },
        },
        400
      );
    }

    if (error instanceof Error) {
      // Check for specific database errors
      if (error.message.includes('unique constraint')) {
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

      if (error.message.includes('foreign key')) {
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
    }

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
