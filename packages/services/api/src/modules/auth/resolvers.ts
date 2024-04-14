import { z } from 'zod';
import { createConnection } from '../../shared/schema';
import { AuthModule } from './__generated__/types';
import { AuthManager } from './providers/auth-manager';
import { OrganizationAccessScope } from './providers/organization-access';
import { ProjectAccessScope } from './providers/project-access';
import { TargetAccessScope } from './providers/target-access';
import { displayNameLengthBoundaries, fullNameLengthBoundaries } from './providers/user-manager';

export const resolvers: AuthModule.Resolvers & {
  OrganizationAccessScope: {
    [K in AuthModule.OrganizationAccessScope]: OrganizationAccessScope;
  };
  ProjectAccessScope: {
    [K in AuthModule.ProjectAccessScope]: ProjectAccessScope;
  };
  TargetAccessScope: {
    [K in AuthModule.TargetAccessScope]: TargetAccessScope;
  };
} = {
  Query: {
    me: (_, __, { injector }) => injector.get(AuthManager).getCurrentUser(),
  },
  Mutation: {
    async updateMe(_, { input }, { injector }) {
      const InputModel = z.object({
        displayName: z
          .string()
          .min(displayNameLengthBoundaries.min)
          .max(displayNameLengthBoundaries.max),
        fullName: z.string().min(fullNameLengthBoundaries.min).max(fullNameLengthBoundaries.max),
      });
      const result = InputModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              displayName: result.error.formErrors.fieldErrors.displayName?.[0],
              fullName: result.error.formErrors.fieldErrors.fullName?.[0],
            },
          },
        };
      }

      const updatedUser = await injector.get(AuthManager).updateCurrentUser(input);

      return {
        ok: {
          updatedUser,
        },
      };
    },
  },
  OrganizationAccessScope: {
    READ: OrganizationAccessScope.READ,
    DELETE: OrganizationAccessScope.DELETE,
    MEMBERS: OrganizationAccessScope.MEMBERS,
    SETTINGS: OrganizationAccessScope.SETTINGS,
    INTEGRATIONS: OrganizationAccessScope.INTEGRATIONS,
  },
  ProjectAccessScope: {
    READ: ProjectAccessScope.READ,
    DELETE: ProjectAccessScope.DELETE,
    ALERTS: ProjectAccessScope.ALERTS,
    SETTINGS: ProjectAccessScope.SETTINGS,
    OPERATIONS_STORE_READ: ProjectAccessScope.OPERATIONS_STORE_READ,
    OPERATIONS_STORE_WRITE: ProjectAccessScope.OPERATIONS_STORE_WRITE,
  },
  TargetAccessScope: {
    READ: TargetAccessScope.READ,
    REGISTRY_READ: TargetAccessScope.REGISTRY_READ,
    REGISTRY_WRITE: TargetAccessScope.REGISTRY_WRITE,
    USAGE_READ: TargetAccessScope.USAGE_READ,
    USAGE_WRITE: TargetAccessScope.USAGE_WRITE,
    DELETE: TargetAccessScope.DELETE,
    SETTINGS: TargetAccessScope.SETTINGS,
    TOKENS_READ: TargetAccessScope.TOKENS_READ,
    TOKENS_WRITE: TargetAccessScope.TOKENS_WRITE,
  },
  Member: {
    organizationAccessScopes(member, _, { injector }) {
      return injector.get(AuthManager).getMemberOrganizationScopes({
        user: member.id,
        organization: member.organization,
      });
    },
    projectAccessScopes(member, _, { injector }) {
      return injector.get(AuthManager).getMemberProjectScopes({
        user: member.id,
        organization: member.organization,
      });
    },
    targetAccessScopes(member, _, { injector }) {
      return injector.get(AuthManager).getMemberTargetScopes({
        user: member.id,
        organization: member.organization,
      });
    },
  },
  UserConnection: createConnection(),
  MemberConnection: createConnection(),
};
