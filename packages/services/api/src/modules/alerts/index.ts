import { createModule } from 'graphql-modules';
import { TeamsCommunicationAdapter } from './providers/adapters/msteams';
import { SlackCommunicationAdapter } from './providers/adapters/slack';
import { WebhookCommunicationAdapter } from './providers/adapters/webhook';
import { AlertsManager } from './providers/alerts-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const alertsModule = createModule({
  id: 'alerts',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [
    AlertsManager,
    SlackCommunicationAdapter,
    WebhookCommunicationAdapter,
    TeamsCommunicationAdapter,
  ],
});
