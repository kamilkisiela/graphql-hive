import { InjectionToken, FactoryProvider, Scope, CONTEXT } from 'graphql-modules';

export const ApiToken = new InjectionToken<string>('x-api-token');
export const ApiTokenProvider: FactoryProvider<string | undefined> = {
  provide: ApiToken,
  useFactory(context: { headers: Record<string, string | string[]> }) {
    let token: string | undefined;

    for (const headerName in context.headers) {
      if (headerName.toLowerCase() === 'x-api-token') {
        const values = context.headers[headerName];
        const singleValue = Array.isArray(values) ? values[0] : values;

        if (singleValue && singleValue !== '') {
          token = singleValue;
        }
      }
    }

    return token;
  },
  deps: [CONTEXT],
  scope: Scope.Operation,
};
