import type { Job } from 'bullmq';
import type { FastifyLoggerInstance, FastifyRequest } from '@hive/service-common';
import type { WebhookInput } from './scheduler';

export interface Config {
  logger: FastifyLoggerInstance;
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
  req: FastifyRequest;
  errorHandler(message: string, error: Error, logger?: FastifyLoggerInstance | undefined): void;
  schedule(webhook: WebhookInput): Promise<Job<any, any, string>>;
};
