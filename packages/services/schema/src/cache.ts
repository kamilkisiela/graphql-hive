import { createHash } from 'crypto';
import type { Redis } from 'ioredis';
import pTimeout from 'p-timeout';
import type { FastifyLoggerInstance } from '@hive/service-common';

function createChecksum<TInput>(input: TInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function createCache(options: {
  redis: Redis;
  logger: Pick<FastifyLoggerInstance, 'debug'>;
  /**
   * Prefix for all keys stored in Redis
   */
  prefix: string;
  /**
   * How often to poll Redis for updates
   */
  pollIntervalMs: number;
  /**
   * How long to wait for an action to complete
   */
  timeoutMs: number;
}) {
  const { prefix, redis, logger, pollIntervalMs, timeoutMs } = options;
  const ttlSeconds = Math.ceil(timeoutMs / 1000);

  async function readAction<T>(id: string): Promise<State<T> | null> {
    const action = await redis.get(id);

    if (action) {
      return JSON.parse(action);
    }

    return null;
  }

  async function startAction(id: string) {
    logger.debug('Starting action (id=%s)', id);
    // Set and lock + expire
    const inserted = await redis.setnx(id, JSON.stringify({ status: 'started' }));

    if (inserted) {
      logger.debug('Started action (id=%s)', id);
      await redis.expire(id, ttlSeconds);
      return {
        status: 'started',
      } as const;
    }

    logger.debug('Reusing action (id=%s)', id);
    return {
      status: 'reusing',
    } as const;
  }

  async function completeAction<T>(id: string, data: T): Promise<void> {
    logger.debug('Completing action (id=%s)', id);
    await redis.setex(
      id,
      ttlSeconds,
      JSON.stringify({
        status: 'completed',
        result: data,
      }),
    );
  }

  async function removeAction(id: string, reason: string): Promise<void> {
    logger.debug('Removing action (id=%s, reason=%s)', id, reason);
    await redis.del(id);
  }

  return {
    timeoutMs,
    reuse<I, O>(groupKey: string, factory: (input: I) => Promise<O>): (input: I) => Promise<O> {
      async function reuseFactory(input: I, attempt = 0): Promise<O> {
        const id = `${prefix}:${groupKey}:${createChecksum(input)}`;

        if (attempt === 3) {
          await removeAction(id, 'too many attempts');
          throw new Error('Tried too many times');
        }

        let cached = await readAction<O>(id);

        if (!cached) {
          const started = await startAction(id);

          if (started.status === 'reusing') {
            return reuseFactory(input, attempt + 1);
          }

          try {
            const result = await pTimeout(factory(input), {
              milliseconds: timeoutMs,
              message: `Timeout: took longer than ${timeoutMs}ms to complete`,
            });
            await completeAction(id, result);
            return result;
          } catch (error) {
            await removeAction(id, String(error));
            throw error;
          }
        }

        const startedAt = Date.now();
        while (cached && cached.status !== 'completed') {
          logger.debug(
            'Waiting for action to complete (id=%s, time=%s)',
            id,
            Date.now() - startedAt,
          );
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
          cached = await readAction<O>(id);

          if (Date.now() - startedAt > timeoutMs) {
            await removeAction(id, 'waiting-timeout');
            throw new Error(`Timeout: Waiting for longer than ${timeoutMs}ms. Exiting`);
          }
        }

        if (!cached) {
          // Action was probably removed, try again
          return reuseFactory(input, attempt + 1);
        }

        return cached.result;
      }

      return reuseFactory;
    },
  };
}

export type Cache = ReturnType<typeof createCache>;

type State<T> =
  | {
      status: 'started';
    }
  | {
      status: 'completed';
      result: T;
    };
