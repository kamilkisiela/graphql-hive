import type { FastifyLoggerInstance } from '@hive/service-common';
import type { Job } from 'bullmq';
import type { RenderedTemplate } from './templates';

export interface Context {
  logger: FastifyLoggerInstance;
  errorHandler(message: string, error: Error, logger?: FastifyLoggerInstance | undefined): void;
  schedule(input: RenderedTemplate): Promise<Job<any, any, string>>;
}
