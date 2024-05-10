import type { FastifyRequest } from '@hive/service-common';

export interface RegistryContext {
  req: FastifyRequest;
  requestId: string;
  user: any;
  headers: Record<string, string | string[] | undefined>;
  request: Request;
}

declare global {
  namespace GraphQLModules {
    interface GlobalContext extends RegistryContext {}
  }
}
