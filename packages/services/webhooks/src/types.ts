import type { FastifyLoggerInstance } from '@hive/service-common';

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
}

export interface WebhookInput {
  endpoint: string;
  event: {
    organization: {
      id: string;
      cleanId: string;
      name: string;
    };
    project: {
      id: string;
      cleanId: string;
      name: string;
    };
    target: {
      id: string;
      cleanId: string;
      name: string;
    };
    schema: {
      id: string;
      valid: boolean;
      commit: string;
    };
    changes: any[];
    errors: any[];
  };
}
