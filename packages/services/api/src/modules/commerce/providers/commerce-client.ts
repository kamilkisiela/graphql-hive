import { FactoryProvider, InjectionToken, Scope, ValueProvider } from 'graphql-modules';
import type { CommerceRouter } from '@hive/commerce';
import { errorSourceLink, requestIdHeaders } from '@hive/service-common';
import { createTRPCProxyClient, httpLink, type CreateTRPCProxyClient } from '@trpc/client';
import type { inferRouterInputs } from '@trpc/server';

export type CommerceTrpcClient = CreateTRPCProxyClient<CommerceRouter> | null;
export type CommerceTrpcClientInputs = inferRouterInputs<CommerceRouter>;
export type CommerceConfig = {
  endpoint: string | null;
  billingEnabled: boolean;
};

export const COMMERCE_TRPC_CLIENT = new InjectionToken<CommerceTrpcClient>('commerce-trpc-client');
export const COMMERCE_CONFIG = new InjectionToken<CommerceConfig>('commerce-config');

export function provideCommerceConfig(config: CommerceConfig): ValueProvider<CommerceConfig> {
  return {
    provide: COMMERCE_CONFIG,
    useValue: config,
    scope: Scope.Singleton,
  };
}

export function provideCommerceClient(): FactoryProvider<CommerceTrpcClient> {
  return {
    provide: COMMERCE_TRPC_CLIENT,
    scope: Scope.Singleton,
    deps: [COMMERCE_CONFIG],
    useFactory(config: CommerceConfig) {
      if (!config.endpoint) {
        return null;
      }

      return createTRPCProxyClient<CommerceRouter>({
        links: [
          errorSourceLink('commerce-service'),
          httpLink({ url: `${config.endpoint}/trpc`, fetch, headers: requestIdHeaders }),
        ],
      });
    },
  };
}
