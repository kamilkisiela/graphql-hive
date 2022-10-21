import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { OIDCIntegrationsProvider } from './providers/oidc-integrations.provider';
import { resolvers } from './resolvers';

export const oidcIntegrationsModule = createModule({
  id: 'oidc-integrations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OIDCIntegrationsProvider],
});
