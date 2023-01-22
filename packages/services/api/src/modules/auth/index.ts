import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { AuthManager } from './providers/auth-manager';
import { OrganizationAccess } from './providers/organization-access';
import { ProjectAccess } from './providers/project-access';
import { TargetAccess } from './providers/target-access';
import { ApiTokenProvider } from './providers/tokens';
import { UserManager } from './providers/user-manager';
import { resolvers } from './resolvers';

export const authModule = createModule({
  id: 'auth',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [
    AuthManager,
    UserManager,
    ApiTokenProvider,
    OrganizationAccess,
    ProjectAccess,
    TargetAccess,
  ],
});
