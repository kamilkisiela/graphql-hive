import { createModule } from 'graphql-modules';
import { OIDCIntegrationsProvider } from './providers/oidc-integrations.provider';
import { resolvers } from './resolvers.generated';
import typeDefs from './module.graphql';

export const oidcIntegrationsModule = createModule({
  id: 'oidc-integrations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OIDCIntegrationsProvider],
});
