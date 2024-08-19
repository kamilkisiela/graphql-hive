import { OIDCIntegrationsProvider } from '../../providers/oidc-integrations.provider';
import type { SubscriptionResolvers } from './../../../../__generated__/types.next';

export const oidcIntegrationLog: NonNullable<SubscriptionResolvers['oidcIntegrationLog']> = {
  subscribe: (_, args, { injector }) =>
    injector
      .get(OIDCIntegrationsProvider)
      .subscribeToOIDCIntegrationLogs({ oidcIntegrationId: args.input.oidcIntegrationId }),
  resolve: (payload: { message: string; timestamp: string }) => payload,
};
