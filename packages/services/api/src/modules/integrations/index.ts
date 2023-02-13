import { createModule } from 'graphql-modules';
import { GitHubIntegrationManager } from './providers/github-integration-manager';
import { SlackIntegrationManager } from './providers/slack-integration-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const integrationsModule = createModule({
  id: 'integrations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [SlackIntegrationManager, GitHubIntegrationManager],
});
