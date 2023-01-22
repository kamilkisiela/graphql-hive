import { createModule } from 'graphql-modules';
import { ActivityManager } from './providers/activity-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const activityModule = createModule({
  id: 'activity',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [ActivityManager],
});
