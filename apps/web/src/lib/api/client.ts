// Enhanced API Client with retry logic, offline detection, circuit breaker, and comprehensive error handling
import type { ApiResponse, ApiError, PaginatedResponse } from '@pos/shared';
import { logger } from '../logging/logger';

const API_URL = import.meta.env.VITE_API_URL || '';

// Retry configuration
const DEFAULT_RETRY_COUNT = 3;
const SYNC_RETRY_COUNT = 1; // Reduced retries for sync endpoints
const DEFAULT_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

// 5xx errors that should be retried
const RETRYABLE_STATUS_CODES = [502, 503, 504];

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening circuit
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 60 seconds

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

// Error types for specific handling
export class NetworkError extends Error {
  constructor(message: string = 'Network error') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  public details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class ServerError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ServerError';
    this.statusCode = statusCode;
  }
}

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  retries?: number;
  retryDelay?: number;
  skipAuth?: boolean;
  timeout?: number;
}

// Get circuit breaker key for an endpoint (group by base path)
function getCircuitBreakerKey(endpoint: string): string {
  // Group endpoints by their base path (e.g., /api/sync, /api/products)
  const parts = endpoint.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return `/${parts[0]}/${parts[1]}`;
  }
  return endpoint;
}

// Check if circuit is open for an endpoint
function isCircuitOpen(endpoint: string): boolean {
  const key = getCircuitBreakerKey(endpoint);
  const state = circuitBreakers.get(key);

  if (!state || !state.isOpen) return false;

  // Check if reset time has passed
  if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_TIME) {
    // Half-open: allow one request through
    state.isOpen = false;
    state.failures = 0;
    return false;
  }

  return true;
}

// Record a failure for circuit breaker
function recordCircuitFailure(endpoint: string): void {
  const key = getCircuitBreakerKey(endpoint);
  const state = circuitBreakers.get(key) || { failures: 0, lastFailure: 0, isOpen: false };

  state.failures++;
  state.lastFailure = Date.now();

  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true;
    logger.warn(`Circuit breaker opened for ${key}`, { failures: state.failures });
  }

  circuitBreakers.set(key, state);
}

// Record a success for circuit breaker
function recordCircuitSuccess(endpoint: string): void {
  const key = getCircuitBreakerKey(endpoint);
  const state = circuitBreakers.get(key);

  if (state) {
    state.failures = 0;
    state.isOpen = false;
  }
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onUnauthorized?: () => void;
  private requestId = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadTokens();
  }

  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    logger.info('Tokens updated');
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    logger.info('Tokens cleared');
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    // Determine if this is a sync endpoint (use reduced retries)
    const isSyncEndpoint = endpoint.includes('/sync');
    const defaultRetries = isSyncEndpoint ? SYNC_RETRY_COUNT : DEFAULT_RETRY_COUNT;

    const {
      params,
      retries = defaultRetries,
      retryDelay = DEFAULT_RETRY_DELAY,
      skipAuth = false,
      timeout = 30000,
      ...init
    } = config;

    const reqId = ++this.requestId;
    const startTime = Date.now();

    // Check circuit breaker
    if (isCircuitOpen(endpoint)) {
      throw new NetworkError(`Service temporarily unavailable (circuit breaker open for ${getCircuitBreakerKey(endpoint)})`);
    }

    // Build URL with params
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Request-ID': `${reqId}-${Date.now()}`,
      ...init.headers,
    };

    if (!skipAuth && this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Add client ID for sync
    const clientId = this.getClientId();
    (headers as Record<string, string>)['X-Client-ID'] = clientId;

    logger.debug(`API Request [${reqId}]`, {
      method: init.method || 'GET',
      endpoint,
      params,
    });

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    let attemptDelay = retryDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle token refresh on 401
        if (response.status === 401 && this.refreshToken && !skipAuth) {
          const refreshed = await this.handleTokenRefresh();
          if (refreshed) {
            // Retry with new token
            (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
            const retryResponse = await fetch(url, { ...init, headers });
            return this.handleResponse<T>(retryResponse, reqId, startTime);
          } else {
            this.clearTokens();
            this.onUnauthorized?.();
            throw new AuthenticationError('Session expired');
          }
        }

        // Check for retryable 5xx errors before handleResponse
        if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < retries) {
          logger.debug(`API Request [${reqId}] got ${response.status}, will retry`, {
            delay: attemptDelay,
          });
          await this.sleep(attemptDelay);
          attemptDelay = Math.min(attemptDelay * 2, MAX_RETRY_DELAY);
          continue;
        }

        const result = await this.handleResponse<T>(response, reqId, startTime, endpoint);

        // Record success for circuit breaker
        recordCircuitSuccess(endpoint);

        return result;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors
        if (error instanceof AuthenticationError) {
          throw error;
        }

        // Don't retry on validation errors (4xx)
        if (error instanceof ValidationError) {
          throw error;
        }

        // Check if it's a network error, timeout, or retryable server error
        const isNetworkError =
          error instanceof TypeError ||
          (error as Error).name === 'AbortError' ||
          error instanceof NetworkError;

        const isRetryableServerError =
          error instanceof ServerError &&
          RETRYABLE_STATUS_CODES.includes((error as ServerError).statusCode);

        const shouldRetry = (isNetworkError || isRetryableServerError) && attempt < retries;

        if (shouldRetry) {
          // Only log debug on intermediate retries (not warning)
          logger.debug(`API Request [${reqId}] attempt ${attempt + 1} failed, will retry`, {
            error: (error as Error).message,
            delay: attemptDelay,
          });

          await this.sleep(attemptDelay);
          attemptDelay = Math.min(attemptDelay * 2, MAX_RETRY_DELAY);
          continue;
        }

        // Final failure - log error and record circuit breaker failure
        const duration = Date.now() - startTime;

        if (isNetworkError || isRetryableServerError) {
          recordCircuitFailure(endpoint);
        }

        // Only log on final failure
        logger.error(`API Request [${reqId}] failed after ${attempt + 1} attempts`, {
          endpoint,
          duration,
          error: (error as Error).message,
        });

        if (isNetworkError) {
          throw new NetworkError('Unable to connect to server. Please check your internet connection.');
        }

        throw error;
      }
    }

    throw lastError || new Error('Request failed');
  }

  private async handleResponse<T>(response: Response, reqId: number, startTime: number, _endpoint?: string): Promise<T> {
    const duration = Date.now() - startTime;
    let data: any;

    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        throw new ServerError('Server returned invalid response', response.status);
      }
      data = null;
    }

    if (!response.ok) {
      const error = data as ApiError;
      const message = error?.error?.message || `Request failed with status ${response.status}`;

      // Only log errors that are not expected/handled
      if (response.status >= 500) {
        logger.warn(`API Response [${reqId}]`, {
          status: response.status,
          duration,
          error: message,
        });
      }

      if (response.status === 400) {
        const details = (error?.error?.details || {}) as Record<string, string[]>;
        throw new ValidationError(message, details);
      }

      if (response.status === 401) {
        throw new AuthenticationError(message);
      }

      if (response.status === 403) {
        throw new Error('Access denied');
      }

      if (response.status === 404) {
        throw new Error('Resource not found');
      }

      if (response.status >= 500) {
        throw new ServerError(message, response.status);
      }

      throw new Error(message);
    }

    logger.debug(`API Response [${reqId}]`, {
      status: response.status,
      duration,
    });

    return data as T;
  }

  private refreshPromise: Promise<boolean> | null = null;

  private async handleTokenRefresh(): Promise<boolean> {
    // If already refreshing, return the existing promise (Promise-based queue)
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create a new refresh promise
    this.refreshPromise = (async () => {
      try {
        logger.debug('Refreshing access token');

        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();
          this.setTokens(data.data.accessToken, data.data.refreshToken);
          logger.info('Token refresh successful');
          return true;
        }

        logger.warn('Token refresh failed', { status: response.status });
        return false;
      } catch (error) {
        logger.error('Token refresh error', { error: (error as Error).message });
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private getClientId(): string {
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem('clientId', clientId);
    }
    return clientId;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // HTTP Methods
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    config?: Partial<RequestConfig>
  ) {
    return this.request<ApiResponse<T>>(endpoint, { method: 'GET', params, ...config });
  }

  async getPaginated<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    config?: Partial<RequestConfig>
  ) {
    return this.request<PaginatedResponse<T>>(endpoint, { method: 'GET', params, ...config });
  }

  async post<T>(endpoint: string, body?: unknown, config?: Partial<RequestConfig>) {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...config,
    });
  }

  async put<T>(endpoint: string, body?: unknown, config?: Partial<RequestConfig>) {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...config,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, config?: Partial<RequestConfig>) {
    return this.request<ApiResponse<T>>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...config,
    });
  }

  async delete<T>(endpoint: string, config?: Partial<RequestConfig>) {
    return this.request<ApiResponse<T>>(endpoint, { method: 'DELETE', ...config });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health', undefined, { skipAuth: true, retries: 1, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiClient(API_URL);
