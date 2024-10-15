import { createModule } from 'graphql-modules';
import { AuthManager } from './providers/auth-manager';
import { OrganizationAccess } from './providers/organization-access';
import { ProjectAccess } from './providers/project-access';
import { TargetAccess } from './providers/target-access';
import { UserManager } from './providers/user-manager';
import { resolvers } from './resolvers.generated';
import typeDefs from './module.graphql';

export const authModule = createModule({
  id: 'auth',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [AuthManager, UserManager, OrganizationAccess, ProjectAccess, TargetAccess],
});
