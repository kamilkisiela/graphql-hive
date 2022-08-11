import { Injectable, Scope, Inject } from 'graphql-modules';
import type { Span } from '@sentry/types';
import { REDIS_INSTANCE } from '../../shared/providers/redis';
import type { Redis } from '../../shared/providers/redis';
import { Logger } from '../../shared/providers/logger';
import { uuid } from '../../../shared/helpers';

/**
 *
 * Deduplicates exact same jobs.
 *
 * https://excalidraw.com/#json=Rcg7Z1f0UZM91kElUrGE3,WhZJ6hQqafV0fY-XdjbHUw
 *
 * Stores the state of the job in Redis with a TTL.
 * When running a job, it asks Redis if the job is already running.
 * If the job is already pending, it will wait for it to finish and return the data (stored on Redis).
 * If the job is not pending, it will run the job, set the state to pending, finish the job, update the state and return the data.
 */

export enum JobStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export interface JobPending {
  status: JobStatus.PENDING;
}

export interface JobCompleted<T> {
  status: JobStatus.COMPLETED;
  payload: T;
}

export interface JobExecutorContext {
  span?: Span;
  attempt: number;
}

@Injectable({
  scope: Scope.Operation,
})
export class IdempotentRunner {
  private logger: Logger;
  constructor(logger: Logger, @Inject(REDIS_INSTANCE) private redis: Redis) {
    this.logger = logger.child({ service: 'IdempotentRunner' });
  }

  async run<T>({
    identifier,
    executor,
    span,
    ttl,
  }: {
    identifier: string;
    executor: (context: JobExecutorContext) => Promise<T>;
    /**
     * In seconds
     */
    ttl: number;
    span?: Span;
  }): Promise<T> {
    const traceId = uuid();
    this.logger.debug('Running idempotent job (id=%s, traceId=%s)', identifier, traceId);
    return this.start({
      identifier,
      traceId,
      executor,
      ttl,
      context: {
        span,
        attempt: 1,
      },
    });
  }

  private async set<T>(identifier: string, job: JobPending | JobCompleted<T>, ttl: number): Promise<boolean> {
    // Set the job as pending
    if (job.status === JobStatus.PENDING) {
      // SET if Not eXists
      const inserted = await this.redis.setnx(identifier, JSON.stringify(job));

      if (inserted) {
        // set TTL if inserted
        await this.redis.expire(identifier, ttl);
        return true;
      }

      return false;
    }

    // set as completed but timeout after N seconds
    await this.redis.setex(identifier, ttl, JSON.stringify(job));
    return true;
  }

  private async get<T>(identifier: string): Promise<null | JobPending | JobCompleted<T>> {
    const cached = await this.redis.get(identifier);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  private async del(identifier: string): Promise<Boolean> {
    const result = await this.redis.del(identifier);
    return result === 1;
  }

  private async start<T>({
    identifier,
    traceId,
    executor,
    ttl,
    context,
  }: {
    identifier: string;
    traceId: string;
    executor: (context: JobExecutorContext) => Promise<T>;
    /**
     * In seconds
     */
    ttl: number;
    context: JobExecutorContext;
  }): Promise<T> {
    this.logger.debug('Starting new job (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
    if (context.attempt > 3) {
      this.logger.error(
        'Job failed after 3 attempts (id=%s, traceId=%s, attempt=%s)',
        identifier,
        traceId,
        context.attempt
      );
      throw new Error(`Job failed after 3 attempts`);
    }

    let job = await this.get<T>(identifier);

    if (!job) {
      this.logger.debug('Job not found (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
      this.logger.debug('Trying to create a job (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
      const created = await this.set(
        identifier,
        {
          status: JobStatus.PENDING,
        },
        ttl
      );

      if (!created) {
        this.logger.debug('Job is pending (id=%s, traceId=%s)', identifier, traceId);
        context.attempt++;
        return this.start({
          identifier,
          traceId,
          executor,
          context: {
            span: context.span?.startChild({
              op: `Attempt #${context.attempt}`,
            }),
            attempt: context.attempt,
          },
          ttl,
        });
      } else {
        this.logger.debug('Job created (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
      }

      this.logger.debug('Executing job (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
      const payload = await executor(context).catch(async error => {
        this.logger.debug('Job execution failed (id=%s, traceId=%s, error=%s)', identifier, traceId, error.message);
        this.logger.debug('Deleting the job (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
        await this.del(identifier);
        return await Promise.reject(error);
      });

      this.logger.debug(
        'Marking job as completed (id=%s, traceId=%s, attempt=%s)',
        identifier,
        traceId,
        context.attempt
      );
      await this.set<T>(
        identifier,
        {
          status: JobStatus.COMPLETED,
          payload,
        },
        ttl
      );
      this.logger.debug('Job completed (id=%s, traceId=%s)', identifier, traceId);

      return payload;
    }

    const startedAt = Date.now();
    while (job && job.status !== JobStatus.COMPLETED) {
      const elapsed = Date.now() - startedAt;
      if (elapsed > ttl * 1000) {
        job = null;
        break;
      }
      this.logger.debug('Awaiting job (id=%s, traceId=%s, time=%s)', identifier, traceId, elapsed);
      await new Promise(resolve => setTimeout(resolve, 500));
      job = await this.get<T>(identifier);
    }

    if (!job) {
      this.logger.debug(
        'Job not found, probably failed to complete (id=%s, traceId=%s, attempt=%s)',
        identifier,
        traceId,
        context.attempt
      );

      context.attempt++;
      return this.start({
        identifier,
        traceId,
        executor,
        context: {
          span: context.span?.startChild({
            op: `Attempt #${context.attempt}`,
          }),
          attempt: context.attempt,
        },
        ttl,
      });
    }

    this.logger.debug(
      'Resolving the job (id=%s, traceId=%s, attempt=%s, status=%s)',
      identifier,
      traceId,
      context.attempt,
      job.status
    );
    return job.payload;
  }
}
