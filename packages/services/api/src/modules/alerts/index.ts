import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { SlackCommunicationAdapter } from './providers/adapters/slack';
import { WebhookCommunicationAdapter } from './providers/adapters/webhook';
import { AlertsManager } from './providers/alerts-manager';
import { resolvers } from './resolvers';

export const alertsModule = createModule({
  id: 'alerts',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [AlertsManager, SlackCommunicationAdapter, WebhookCommunicationAdapter],
});
