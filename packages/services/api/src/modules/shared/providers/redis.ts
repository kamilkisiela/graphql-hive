import type { FactoryProvider } from 'graphql-modules';
import { InjectionToken } from 'graphql-modules';
import type { Redis as RedisInstance, RedisOptions } from 'ioredis';
import Redis from 'ioredis';
import { Logger } from './logger';

export type { RedisInstance as Redis };

export type RedisConfig = Required<Pick<RedisOptions, 'host' | 'port' | 'password'>>;

export const REDIS_CONFIG = new InjectionToken<RedisConfig>('REDIS_CONFIG');
export const REDIS_INSTANCE = new InjectionToken<RedisInstance>('REDIS_INSTANCE');

export const RedisProvider: FactoryProvider<RedisInstance> = {
  provide: REDIS_INSTANCE,
  useFactory(config: RedisConfig, mainLogger: Logger) {
    const logger = mainLogger.child({
      source: 'Redis',
    });
    const redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      retryStrategy(times) {
        return Math.min(times * 500, 2000);
      },
      reconnectOnError(error) {
        logger.warn('Redis reconnectOnError (error=%s)', error);
        return 1;
      },
      db: 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redis.on('error', err => {
      logger.error('Redis connection error (error=%s)', err);
    });

    redis.on('connect', () => {
      logger.debug('Redis connection established');
    });

    redis.on('ready', () => {
      logger.info('Redis connection ready');
    });

    redis.on('close', () => {
      logger.info('Redis connection closed');
    });

    redis.on('reconnecting', (timeToReconnect?: number) => {
      logger.info('Redis reconnecting in %s', timeToReconnect);
    });

    return redis;
  },
  deps: [REDIS_CONFIG, Logger],
};
