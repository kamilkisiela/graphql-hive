import { Injectable, Scope, Inject } from 'graphql-modules';
import type { Span } from '@sentry/types';
import { REDIS_INSTANCE } from '../../shared/providers/redis';
import type { Redis } from '../../shared/providers/redis';
import { Logger } from '../../shared/providers/logger';
import { uuid } from '../../../shared/helpers';

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

  private async set(identifier: string, job: JobPending, ttl: number): Promise<boolean>;
  private async set<T>(identifier: string, job: JobCompleted<T>, ttl: number): Promise<boolean>;
  private async set<T>(identifier: string, job: JobPending | JobCompleted<T>, ttl: number): Promise<boolean> {
    if (job.status === JobStatus.PENDING) {
      // SET if Not eXists
      const inserted = await this.redis.setnx(identifier, JSON.stringify(job));

      if (inserted) {
        // expire if inserted
        await this.redis.expire(identifier, ttl);
      }

      return inserted === 1;
    }

    // remove the key and set + expire
    await this.redis.setex(identifier, ttl, JSON.stringify(job));
    return true;
  }

  private async get(identifier: string): Promise<null>;
  private async get(identifier: string): Promise<JobPending>;
  private async get<T>(identifier: string): Promise<JobCompleted<T>>;
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
      }

      this.logger.debug('Executing job (id=%s, traceId=%s, attempt=%s)', identifier, traceId, context.attempt);
      const payload = await executor(context).catch(async error => {
        this.logger.debug('Job execution failed (id=%s, traceId=%s, error=%s)', identifier, traceId, error.message);
        console.error(error);
        await this.del(identifier);
        return await Promise.reject(error);
      });
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
      this.logger.debug('Awaiting job (id=%s, traceId=%s, time=%s)', identifier, traceId, Date.now() - startedAt);
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
      'Resolving the runner (id=%s, traceId=%s, attempt=%s, status=%s)',
      identifier,
      traceId,
      context.attempt,
      job.status
    );
    return job.payload;
  }
}
