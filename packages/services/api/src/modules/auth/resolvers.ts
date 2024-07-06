import { createConnection } from '../../shared/schema';
import { AuthModule } from './__generated__/types';
import { AuthManager } from './providers/auth-manager';

export const resolvers: AuthModule.Resolvers = {
  Member: {
    organizationAccessScopes(member, _, { injector }) {
      return injector.get(AuthManager).getMemberOrganizationScopes({
        user: member.user.id,
        organization: member.organization,
      });
    },
    projectAccessScopes(member, _, { injector }) {
      return injector.get(AuthManager).getMemberProjectScopes({
        user: member.user.id,
        organization: member.organization,
      });
    },
    targetAccessScopes(member, _, { injector }) {
      return injector.get(AuthManager).getMemberTargetScopes({
        user: member.user.id,
        organization: member.organization,
      });
    },
  },
  UserConnection: createConnection(),
  MemberConnection: createConnection(),
};
