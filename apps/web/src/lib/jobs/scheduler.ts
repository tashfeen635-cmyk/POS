// Background Job Scheduler for periodic tasks
import { logger } from '../logging/logger';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

interface Job {
  id: string;
  name: string;
  handler: () => Promise<void>;
  interval: number; // ms
  priority: JobPriority;
  lastRun: Date | null;
  nextRun: Date;
  isRunning: boolean;
  runCount: number;
  errorCount: number;
  enabled: boolean;
}

interface JobOptions {
  priority?: JobPriority;
  runImmediately?: boolean;
  enabled?: boolean;
}

const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

class JobScheduler {
  private jobs: Map<string, Job> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isRunning = false;
  private maxConcurrent = 3;
  private currentlyRunning = 0;
  private jobQueue: string[] = [];

  constructor() {
    // Pause jobs when tab is hidden
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.pause();
        } else {
          this.resume();
        }
      });
    }
  }

  // Register a new job
  register(
    id: string,
    name: string,
    handler: () => Promise<void>,
    interval: number,
    options: JobOptions = {}
  ): void {
    const { priority = 'normal', runImmediately = false, enabled = true } = options;

    const job: Job = {
      id,
      name,
      handler,
      interval,
      priority,
      lastRun: null,
      nextRun: runImmediately ? new Date() : new Date(Date.now() + interval),
      isRunning: false,
      runCount: 0,
      errorCount: 0,
      enabled,
    };

    this.jobs.set(id, job);
    logger.info(`Job registered: ${name}`, { id, interval, priority });

    if (this.isRunning && enabled) {
      this.scheduleJob(id);
    }
  }

  // Unregister a job
  unregister(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.jobs.delete(id);
    logger.info(`Job unregistered`, { id });
  }

  // Enable/disable a job
  setEnabled(id: string, enabled: boolean): void {
    const job = this.jobs.get(id);
    if (job) {
      job.enabled = enabled;
      if (enabled && this.isRunning) {
        this.scheduleJob(id);
      } else if (!enabled) {
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }
      }
    }
  }

  // Start the scheduler
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Job scheduler started');

    // Schedule all enabled jobs
    for (const [id, job] of this.jobs) {
      if (job.enabled) {
        this.scheduleJob(id);
      }
    }
  }

  // Stop the scheduler
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    logger.info('Job scheduler stopped');

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // Pause scheduler (e.g., when tab is hidden)
  private pause(): void {
    if (!this.isRunning) return;

    logger.debug('Job scheduler paused');
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // Resume scheduler
  private resume(): void {
    if (!this.isRunning) return;

    logger.debug('Job scheduler resumed');
    for (const [id, job] of this.jobs) {
      if (job.enabled && !job.isRunning) {
        this.scheduleJob(id);
      }
    }
  }

  // Schedule a single job
  private scheduleJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job || !job.enabled || job.isRunning) return;

    // Clear existing timer
    const existingTimer = this.timers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate delay
    const now = Date.now();
    const delay = Math.max(0, job.nextRun.getTime() - now);

    const timer = setTimeout(() => {
      this.queueJob(id);
    }, delay);

    this.timers.set(id, timer);
  }

  // Add job to execution queue
  private queueJob(id: string): void {
    if (!this.jobQueue.includes(id)) {
      this.jobQueue.push(id);
      // Sort by priority
      this.jobQueue.sort((a, b) => {
        const jobA = this.jobs.get(a);
        const jobB = this.jobs.get(b);
        if (!jobA || !jobB) return 0;
        return PRIORITY_ORDER[jobB.priority] - PRIORITY_ORDER[jobA.priority];
      });
    }
    this.processQueue();
  }

  // Process job queue
  private processQueue(): void {
    while (this.currentlyRunning < this.maxConcurrent && this.jobQueue.length > 0) {
      const id = this.jobQueue.shift();
      if (id) {
        this.executeJob(id);
      }
    }
  }

  // Execute a job
  private async executeJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || job.isRunning) return;

    job.isRunning = true;
    this.currentlyRunning++;

    const startTime = Date.now();

    try {
      logger.debug(`Job starting: ${job.name}`, { id });
      await job.handler();

      job.runCount++;
      job.lastRun = new Date();

      const duration = Date.now() - startTime;
      logger.debug(`Job completed: ${job.name}`, { id, duration });
    } catch (error) {
      job.errorCount++;
      logger.error(`Job failed: ${job.name}`, {
        id,
        error: (error as Error).message,
        errorCount: job.errorCount,
      });
    } finally {
      job.isRunning = false;
      this.currentlyRunning--;

      // Schedule next run
      job.nextRun = new Date(Date.now() + job.interval);
      if (this.isRunning && job.enabled) {
        this.scheduleJob(id);
      }

      // Process queue
      this.processQueue();
    }
  }

  // Run a job immediately
  async runNow(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    if (job.isRunning) {
      logger.warn(`Job already running: ${job.name}`, { id });
      return;
    }

    // Clear scheduled timer and run immediately
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    await this.executeJob(id);
  }

  // Get job status
  getStatus(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  // Get all jobs status
  getAllStatus(): Job[] {
    return Array.from(this.jobs.values());
  }

  // Get scheduler stats
  getStats(): {
    isRunning: boolean;
    totalJobs: number;
    activeJobs: number;
    currentlyRunning: number;
    queueLength: number;
    jobs: Array<{ id: string; name: string; lastRun: Date | null; runCount: number; errorCount: number }>;
  } {
    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      activeJobs: Array.from(this.jobs.values()).filter((j) => j.enabled).length,
      currentlyRunning: this.currentlyRunning,
      queueLength: this.jobQueue.length,
      jobs: Array.from(this.jobs.values()).map((j) => ({
        id: j.id,
        name: j.name,
        lastRun: j.lastRun,
        runCount: j.runCount,
        errorCount: j.errorCount,
      })),
    };
  }
}

// Export singleton instance
export const scheduler = new JobScheduler();

// Helper to create a simple interval job
export function createIntervalJob(
  name: string,
  handler: () => Promise<void>,
  intervalMs: number,
  options?: JobOptions
): string {
  const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  scheduler.register(id, name, handler, intervalMs, options);
  return id;
}
