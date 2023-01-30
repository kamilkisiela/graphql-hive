import type { Job } from 'bullmq';
import type { FastifyRequest } from '@hive/service-common';
import type { EmailInput } from './shapes';

export type Context = {
  req: FastifyRequest;
  errorHandler(message: string, error: Error): void;
  schedule(input: EmailInput): Promise<Job<any, any, string>>;
};
