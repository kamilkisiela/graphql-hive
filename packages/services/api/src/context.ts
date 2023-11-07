export interface RegistryContext {
  req: any;
  requestId: string;
  user: any;
  headers: Record<string, string | string[] | undefined>;
  abortSignal: AbortSignal;
}

declare global {
  namespace GraphQLModules {
    interface GlobalContext extends RegistryContext {}
  }
}
