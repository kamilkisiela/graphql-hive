import { createConnection } from '../../shared/schema';
import { AuthModule } from './__generated__/types';
import { AuthManager } from './providers/auth-manager';
import { TargetAccessScope } from './providers/target-access';

export const resolvers: AuthModule.Resolvers & {
  TargetAccessScope: {
    [K in AuthModule.TargetAccessScope]: TargetAccessScope;
  };
} = {
  TargetAccessScope: {
    READ: TargetAccessScope.READ,
    REGISTRY_READ: TargetAccessScope.REGISTRY_READ,
    REGISTRY_WRITE: TargetAccessScope.REGISTRY_WRITE,
    DELETE: TargetAccessScope.DELETE,
    SETTINGS: TargetAccessScope.SETTINGS,
    TOKENS_READ: TargetAccessScope.TOKENS_READ,
    TOKENS_WRITE: TargetAccessScope.TOKENS_WRITE,
  },
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
