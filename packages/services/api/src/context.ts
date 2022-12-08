export interface RegistryContext {
  req: any;
  requestId: string;
  user: any;
  headers: Record<string, string | string[] | undefined>;
  abortSignal: AbortSignal;
}

declare global {
  namespace GraphQLModules {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface GlobalContext extends RegistryContext {}
  }
}
