import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { ActivityManager } from './providers/activity-manager';
import { resolvers } from './resolvers';

export const activityModule = createModule({
  id: 'activity',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [ActivityManager],
});
