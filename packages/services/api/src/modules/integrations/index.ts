import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';
import { SlackIntegrationManager } from './providers/slack-integration-manager';
import { GitHubIntegrationManager } from './providers/github-integration-manager';

export const integrationsModule = createModule({
  id: 'integrations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [SlackIntegrationManager, GitHubIntegrationManager],
});
