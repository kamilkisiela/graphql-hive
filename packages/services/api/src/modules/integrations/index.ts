import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { GitHubIntegrationManager } from './providers/github-integration-manager';
import { SlackIntegrationManager } from './providers/slack-integration-manager';
import { resolvers } from './resolvers';

export const integrationsModule = createModule({
  id: 'integrations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [SlackIntegrationManager, GitHubIntegrationManager],
});
