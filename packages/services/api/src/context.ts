export interface RegistryContext {
  req: any;
  requestId?: string | null;
  user: any;
  headers: Record<string, string | string[] | undefined>;
  abortSignal: AbortSignal;
}

declare global {
  namespace GraphQLModules {
    type GlobalContext = RegistryContext
  }
}
