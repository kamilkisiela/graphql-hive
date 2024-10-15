import type { FastifyRequest } from '@hive/service-common';
import { Session } from './modules/auth/lib/authz';

export interface RegistryContext {
  req: FastifyRequest;
  requestId: string;
  user: any;
  headers: Record<string, string | string[] | undefined>;
  request: Request;
  session: Session;
}

declare global {
  namespace GraphQLModules {
    interface GlobalContext extends RegistryContext {}
  }
}
