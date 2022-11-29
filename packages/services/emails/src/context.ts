import type { FastifyLoggerInstance } from '@hive/service-common';
import type { Job } from 'bullmq';
import type { EmailInput } from './shapes';

export type Context = {
  logger: FastifyLoggerInstance;
  errorHandler(message: string, error: Error, logger?: FastifyLoggerInstance | undefined): void;
  schedule(input: EmailInput): Promise<Job<any, any, string>>;
};
