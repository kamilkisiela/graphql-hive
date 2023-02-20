import { createModule } from 'graphql-modules';
import { OrganizationManager } from './providers/organization-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const organizationModule = createModule({
  id: 'organization',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OrganizationManager],
});
