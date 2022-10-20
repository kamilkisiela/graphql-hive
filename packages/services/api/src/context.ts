export {};

declare global {
  namespace GraphQLModules {
    interface GlobalContext {
      req: any;
      requestId: string;
      user: any;
      headers: Record<string, string>;
      internalSignature: {
        expected: string;
        received: string | null;
      };
    }
  }
}
