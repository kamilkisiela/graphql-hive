import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { OrganizationManager } from './providers/organization-manager';
import { resolvers } from './resolvers';

export const organizationModule = createModule({
  id: 'organization',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OrganizationManager],
});
