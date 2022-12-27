import type { createLogger, FastifyLoggerInstance } from '@hive/service-common';
import type { Job } from 'bullmq';
import type { WebhookInput } from './scheduler';

export interface Config {
  logger: FastifyLoggerInstance | ReturnType<typeof createLogger>;
  redis: {
    host: string;
    port: number;
    password: string;
  };
  webhookQueueName: string;
  maxAttempts: number;
  backoffDelay: number;
  requestBroker: null | {
    endpoint: string;
    signature: string;
  };
}

export type Context = {
  logger: FastifyLoggerInstance;
  errorHandler(message: string, error: Error, logger?: FastifyLoggerInstance | undefined): void;
  schedule(webhook: WebhookInput): Promise<Job<any, any, string>>;
};
