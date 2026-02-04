// Production-ready Logging Service with levels, persistence, and remote reporting
import { db } from '../db';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  source?: string;
  userId?: string;
  sessionId?: string;
}

interface LoggerConfig {
  minLevel: LogLevel;
  console: boolean;
  persist: boolean;
  maxPersistedLogs: number;
  remoteEndpoint?: string;
  remoteMinLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: import.meta.env.DEV ? 'debug' : 'info',
  console: true,
  persist: true,
  maxPersistedLogs: 1000,
  remoteMinLevel: 'error',
};

class Logger {
  private config: LoggerConfig;
  private sessionId: string;
  private userId: string | null = null;
  private logBuffer: LogEntry[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();

    // Flush logs on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private createEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source: 'web',
      userId: this.userId || undefined,
      sessionId: this.sessionId,
    };
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    return `[${time}] [${entry.level.toUpperCase()}] ${entry.message}`;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.console) return;

    const message = this.formatConsoleMessage(entry);
    const styles: Record<LogLevel, string> = {
      debug: 'color: gray',
      info: 'color: blue',
      warn: 'color: orange',
      error: 'color: red; font-weight: bold',
    };

    switch (entry.level) {
      case 'debug':
        console.debug(`%c${message}`, styles.debug, entry.data || '');
        break;
      case 'info':
        console.info(`%c${message}`, styles.info, entry.data || '');
        break;
      case 'warn':
        console.warn(`%c${message}`, styles.warn, entry.data || '');
        break;
      case 'error':
        console.error(`%c${message}`, styles.error, entry.data || '');
        break;
    }
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    if (!this.config.persist) return;

    this.logBuffer.push(entry);

    // Debounce flush
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), 1000);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (
      !this.config.remoteEndpoint ||
      LOG_LEVELS[entry.level] < LOG_LEVELS[this.config.remoteMinLevel || 'error']
    ) {
      return;
    }

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        keepalive: true, // Ensure request completes even if page unloads
      });
    } catch {
      // Silently fail - we don't want to create infinite loops
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.logBuffer.length === 0) return;

    const logsToSave = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Save to IndexedDB
      const existing = (await db.settings.get('logs'))?.value as LogEntry[] || [];
      const combined = [...existing, ...logsToSave];

      // Keep only recent logs
      const trimmed = combined.slice(-this.config.maxPersistedLogs);

      await db.settings.put({
        key: 'logs',
        value: trimmed,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, data);

    this.logToConsole(entry);
    this.persistLog(entry);

    if (level === 'error') {
      this.sendToRemote(entry);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  // Get persisted logs
  async getLogs(options: { level?: LogLevel; limit?: number; since?: Date } = {}): Promise<LogEntry[]> {
    const { level, limit = 100, since } = options;

    const logs = ((await db.settings.get('logs'))?.value as LogEntry[]) || [];

    let filtered = logs;

    if (level) {
      filtered = filtered.filter((log) => LOG_LEVELS[log.level] >= LOG_LEVELS[level]);
    }

    if (since) {
      filtered = filtered.filter((log) => new Date(log.timestamp) >= since);
    }

    return filtered.slice(-limit);
  }

  // Clear persisted logs
  async clearLogs(): Promise<void> {
    await db.settings.put({
      key: 'logs',
      value: [],
      updatedAt: new Date().toISOString(),
    });
  }

  // Export logs as JSON
  async exportLogs(): Promise<string> {
    const logs = await this.getLogs({ limit: this.config.maxPersistedLogs });
    return JSON.stringify(logs, null, 2);
  }

  // Create a child logger with context
  child(context: Record<string, unknown>): ContextLogger {
    return new ContextLogger(this, context);
  }
}

// Child logger that adds context to all logs
class ContextLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  private mergeData(data?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...data };
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeData(data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeData(data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.parent.warn(message, this.mergeData(data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.parent.error(message, this.mergeData(data));
  }
}

// Export singleton instance
export const logger = new Logger();

// Error boundary helper
export function logError(error: Error, context?: Record<string, unknown>): void {
  logger.error(error.message, {
    ...context,
    stack: error.stack,
    name: error.name,
  });
}

// Performance logging
export function logPerformance(name: string, duration: number, context?: Record<string, unknown>): void {
  const level = duration > 3000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  logger[level](`Performance: ${name}`, {
    ...context,
    duration,
    durationMs: `${duration}ms`,
  });
}

// Create performance timer
export function createTimer(name: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    logPerformance(name, duration);
  };
}
