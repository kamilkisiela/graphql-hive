import { CONTEXT, Inject, Injectable, InjectionToken, Scope } from 'graphql-modules';
import type { TransmissionAPI } from '@hive/transmission';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

export const TRANSMISSION_ENDPOINT = new InjectionToken<string>('TRANSMISSION_ENDPOINT');

@Injectable({
  scope: Scope.Operation,
})
export class Transmission {
  public client;

  constructor(
    @Inject(TRANSMISSION_ENDPOINT) endpoint: string,
    @Inject(CONTEXT) context: GraphQLModules.ModuleContext,
  ) {
    this.client = createTRPCProxyClient<TransmissionAPI>({
      links: [
        httpLink({
          url: `${endpoint}/trpc`,
          fetch,
          headers: {
            'x-request-id': context.requestId,
          },
        }),
      ],
    });
  }
}
