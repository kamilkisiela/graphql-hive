import { createHash } from 'node:crypto';
import { z } from 'zod';
import { NameModel } from '../../shared/entities';
import { createConnection } from '../../shared/schema';
import { AuthManager } from '../auth/providers/auth-manager';
import {
  isOrganizationScope,
  OrganizationAccessScope,
} from '../auth/providers/organization-access';
import { isProjectScope, ProjectAccessScope } from '../auth/providers/project-access';
import { isTargetScope, TargetAccessScope } from '../auth/providers/target-access';
import { OIDCIntegrationsProvider } from '../oidc-integrations/providers/oidc-integrations.provider';
import { InMemoryRateLimiter } from '../rate-limit/providers/in-memory-rate-limiter';
import { IdTranslator } from '../shared/providers/id-translator';
import { Logger } from '../shared/providers/logger';
import type { OrganizationModule } from './__generated__/types';
import { OrganizationManager } from './providers/organization-manager';

const OrganizationNameModel = NameModel.min(2).max(50);

const createOrUpdateMemberRoleInputSchema = z.object({
  name: z
    .string({
      required_error: 'Please enter role name',
    })
    .trim()
    .min(2, 'Role name must be at least 2 characters long')
    .max(64, 'Role name must be at most 64 characters long')
    .refine(
      val => typeof val === 'string' && val.length > 0 && val[0] === val[0].toUpperCase(),
      'Must start with a capital letter',
    )
    .refine(val => val !== 'Viewer' && val !== 'Admin', 'Viewer and Admin are reserved'),
  description: z
    .string({
      required_error: 'Please enter role description',
    })
    .trim()
    .min(2, 'Role description must be at least 2 characters long')
    .max(256, 'Role description must be at most 256 characters long'),
});

export const resolvers: OrganizationModule.Resolvers = {
  Query: {
    async organization(_, { selector }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

      return {
        selector,
        organization: await injector.get(OrganizationManager).getOrganization({
          organization,
        }),
      };
    },
    async organizations(_, __, { injector }) {
      return injector.get(OrganizationManager).getOrganizations();
    },
    async myDefaultOrganization(_, { previouslyVisitedOrganizationId }, { injector }) {
      const user = await injector.get(AuthManager).getCurrentUser();
      const organizationManager = injector.get(OrganizationManager);

      // For an OIDC Integration User we want to return the linked organization
      if (user?.oidcIntegrationId) {
        const oidcIntegration = await injector
          .get(OIDCIntegrationsProvider)
          .getOIDCIntegrationById({
            oidcIntegrationId: user.oidcIntegrationId,
          });
        if (oidcIntegration.type === 'ok') {
          const org = await organizationManager.getOrganization({
            organization: oidcIntegration.organizationId,
          });

          return {
            selector: {
              organization: org.cleanId,
            },
            organization: org,
          };
        }

        return null;
      }

      // This is the organization that got stored as an cookie
      // We make sure it actually exists before directing to it.
      if (previouslyVisitedOrganizationId) {
        const orgId = await injector.get(IdTranslator).translateOrganizationId({
          organization: previouslyVisitedOrganizationId,
        });

        const org = await organizationManager.getOrganization({
          organization: orgId,
        });

        if (org) {
          return {
            selector: {
              organization: org.cleanId,
            },
            organization: org,
          };
        }
      }

      if (user?.id) {
        const allOrganizations = await organizationManager.getOrganizations();

        if (allOrganizations.length > 0) {
          const firstOrg = allOrganizations[0];

          return {
            selector: {
              organization: firstOrg.cleanId,
            },
            organization: firstOrg,
          };
        }
      }

      return null;
    },
    async organizationByInviteCode(_, { code }, { injector }) {
      const organization = await injector.get(OrganizationManager).getOrganizationByInviteCode({
        code,
      });

      if ('message' in organization) {
        return organization;
      }

      return {
        __typename: 'OrganizationInvitationPayload',
        name: organization.name,
      };
    },
    async organizationTransferRequest(_, { selector }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(selector);
      const organizationManager = injector.get(OrganizationManager);

      const transferRequest = await organizationManager.getOwnershipTransferRequest({
        organization: organizationId,
        code: selector.code,
      });

      if (!transferRequest) {
        return null;
      }

      return {
        organization: await organizationManager.getOrganization({
          organization: organizationId,
        }),
      };
    },
  },
  Mutation: {
    async createOrganization(_, { input }, { injector }) {
      const organizationNameResult = OrganizationNameModel.safeParse(input.name.trim());
      if (!organizationNameResult.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              name: organizationNameResult.error.issues[0].message ?? null,
            },
          },
        };
      }

      const user = await injector.get(AuthManager).getCurrentUser();
      const organization = await injector.get(OrganizationManager).createOrganization({
        name: input.name,
        user,
      });

      return {
        ok: {
          createdOrganizationPayload: {
            selector: {
              organization: organization.cleanId,
            },
            organization,
          },
        },
      };
    },
    async deleteOrganization(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const organizationId = await translator.translateOrganizationId({
        organization: selector.organization,
      });
      const organization = await injector.get(OrganizationManager).deleteOrganization({
        organization: organizationId,
      });
      return {
        selector: {
          organization: organizationId,
        },
        organization,
      };
    },
    async leaveOrganization(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const organizationId = await translator.translateOrganizationId({
        organization: input.organization,
      });

      const result = await injector.get(OrganizationManager).leaveOrganization(organizationId);

      if (!result.ok) {
        return {
          error: {
            message: result.message,
          },
        };
      }

      return {
        ok: {
          organizationId,
        },
      };
    },
    async updateOrganizationName(_, { input }, { injector }) {
      const result = OrganizationNameModel.safeParse(input.name?.trim());

      if (!result.success) {
        return {
          error: {
            message:
              result.error.formErrors.fieldErrors?.[0]?.[0] ??
              'Changing the organization name failed.',
          },
        };
      }

      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

      const organization = await injector.get(OrganizationManager).updateName({
        name: input.name,
        organization: organizationId,
      });

      return {
        ok: {
          updatedOrganizationPayload: {
            selector: {
              organization: organization.cleanId,
            },
            organization,
          },
        },
      };
    },
    async joinOrganization(_, { code }, { injector }) {
      const organization = await injector.get(OrganizationManager).joinOrganization({ code });

      if ('message' in organization) {
        return organization;
      }

      return {
        __typename: 'OrganizationPayload',
        selector: {
          organization: organization.cleanId,
        },
        organization,
      };
    },
    async deleteOrganizationMember(_, { input }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
      const organization = await injector
        .get(OrganizationManager)
        .deleteMember({ organization: organizationId, user: input.user });

      return {
        selector: input,
        organization,
      };
    },
    async deleteOrganizationInvitation(_, { input }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
      const invitation = await injector
        .get(OrganizationManager)
        .deleteInvitation({ organization: organizationId, email: input.email });

      if (invitation) {
        return {
          ok: invitation,
        };
      }

      return {
        error: {
          message: 'Invitation not found',
        },
      };
    },
    async updateOrganizationMemberAccess(_, { input }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);

      return {
        selector: {
          organization: input.organization,
        },
        organization: await injector.get(OrganizationManager).updateMemberAccess({
          organization,
          user: input.user,
          organizationScopes: input.organizationScopes,
          projectScopes: input.projectScopes,
          targetScopes: input.targetScopes,
        }),
      };
    },
    async inviteToOrganizationByEmail(_, { input }, { injector }) {
      await injector.get(InMemoryRateLimiter).check(
        'inviteToOrganizationByEmail',
        5_000, // 5 seconds
        6, // 6 invites
        `Exceeded rate limit for inviting to organization by email.`,
      );

      const InputModel = z.object({
        email: z.string().email().max(128, 'Email must be at most 128 characters long'),
      });
      const result = InputModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              email: result.error.formErrors.fieldErrors.email?.[0],
            },
          },
        };
      }
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);
      return await injector.get(OrganizationManager).inviteByEmail({
        organization,
        email: input.email,
        role: input.role,
      });
    },
    async requestOrganizationTransfer(_, { input }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);
      return injector.get(OrganizationManager).requestOwnershipTransfer({
        organization,
        user: input.user,
      });
    },
    async answerOrganizationTransferRequest(_, { input }, { injector }) {
      const organization = await injector.get(IdTranslator).translateOrganizationId(input);

      try {
        await injector.get(OrganizationManager).answerOwnershipTransferRequest({
          organization,
          code: input.code,
          accept: input.accept,
        });

        return {
          ok: {
            accepted: input.accept,
          },
        };
      } catch (error) {
        injector.get(Logger).error(error as any);

        return {
          error: {
            message: 'Failed to answer the request',
          },
        };
      }
    },
    async createMemberRole(_, { input }, { injector }) {
      const inputValidation = createOrUpdateMemberRoleInputSchema.safeParse({
        name: input.name,
        description: input.description,
      });

      if (!inputValidation.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              name: inputValidation.error.formErrors.fieldErrors.name?.[0],
              description: inputValidation.error.formErrors.fieldErrors.description?.[0],
            },
          },
        };
      }

      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

      return injector.get(OrganizationManager).createMemberRole({
        organizationId,
        name: inputValidation.data.name,
        description: inputValidation.data.description,
        organizationAccessScopes: input.organizationAccessScopes,
        projectAccessScopes: input.projectAccessScopes,
        targetAccessScopes: input.targetAccessScopes,
      });
    },
    async updateMemberRole(_, { input }, { injector }) {
      const inputValidation = createOrUpdateMemberRoleInputSchema.safeParse({
        name: input.name,
        description: input.description,
      });

      if (!inputValidation.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              name: inputValidation.error.formErrors.fieldErrors.name?.[0],
              description: inputValidation.error.formErrors.fieldErrors.description?.[0],
            },
          },
        };
      }
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

      return injector.get(OrganizationManager).updateMemberRole({
        organizationId,
        roleId: input.role,
        name: inputValidation.data.name,
        description: inputValidation.data.description,
        organizationAccessScopes: input.organizationAccessScopes,
        projectAccessScopes: input.projectAccessScopes,
        targetAccessScopes: input.targetAccessScopes,
      });
    },
    async deleteMemberRole(_, { input }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

      return injector.get(OrganizationManager).deleteMemberRole({
        organizationId,
        roleId: input.role,
      });
    },
    async assignMemberRole(_, { input }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

      return injector.get(OrganizationManager).assignMemberRole({
        organizationId,
        memberId: input.member,
        roleId: input.role,
      });
    },
    async migrateUnassignedMembers(_, { input }, { injector }) {
      const organizationIdFromInput =
        input.assignRole?.organization ?? input.createRole?.organization;

      if (!organizationIdFromInput) {
        return {
          error: {
            message: 'Assign a role or create a new one',
          },
        };
      }

      const organizationId = await injector.get(IdTranslator).translateOrganizationId({
        organization: organizationIdFromInput,
      });

      return injector.get(OrganizationManager).migrateUnassignedMembers({
        organizationId,
        assignRole: input.assignRole,
        createRole: input.createRole,
      });
    },
  },
  Organization: {
    __isTypeOf(organization) {
      return !!organization.id;
    },
    owner(organization, _, { injector }) {
      return injector
        .get(OrganizationManager)
        .getOrganizationOwner({ organization: organization.id });
    },
    async me(organization, _, { injector }) {
      const me = await injector.get(AuthManager).getCurrentUser();
      const members = await injector
        .get(OrganizationManager)
        .getOrganizationMembers({ organization: organization.id });

      return members.find(m => m.id === me.id)!;
    },
    members(organization, _, { injector }) {
      return injector
        .get(OrganizationManager)
        .getOrganizationMembers({ organization: organization.id });
    },
    async invitations(organization, _, { injector }) {
      const invitations = await injector.get(OrganizationManager).getInvitations({
        organization: organization.id,
      });

      return {
        total: invitations.length,
        nodes: invitations,
      };
    },
    memberRoles(organization, _, { injector }) {
      return injector.get(OrganizationManager).getMemberRoles({
        organizationId: organization.id,
      });
    },
    async unassignedMembersToMigrate(organization, _, { injector }) {
      const members = await injector.get(OrganizationManager).getMembersWithoutRole({
        organizationId: organization.id,
      });

      if (members.length === 0) {
        return [];
      }

      const groupedByAccessScope: {
        [accessHash: string]: {
          organizationScopes: OrganizationAccessScope[];
          projectScopes: ProjectAccessScope[];
          targetScopes: TargetAccessScope[];
          members: Array<(typeof members)[number]>;
        };
      } = {};

      for (const member of members) {
        const hasher = createHash('md5');
        hasher.update([...member.scopes].sort().join(','));
        const accessHash = hasher.digest('hex');

        if (!groupedByAccessScope[accessHash]) {
          groupedByAccessScope[accessHash] = {
            organizationScopes: member.scopes.filter(isOrganizationScope),
            projectScopes: member.scopes.filter(isProjectScope),
            targetScopes: member.scopes.filter(isTargetScope),
            members: [],
          };
        }

        groupedByAccessScope[accessHash].members.push(member);
      }

      return (
        Object.entries(groupedByAccessScope)
          .map(([accessHash, group]) => ({
            id: accessHash,
            organizationScopes: group.organizationScopes,
            projectScopes: group.projectScopes,
            targetScopes: group.targetScopes,
            members: group.members,
          }))
          // Sort by the number of members in the group in descending order
          .sort((a, b) => b.members.length - a.members.length)
      );
    },
  },
  OrganizationInvitation: {
    id(invitation) {
      return Buffer.from(
        [invitation.organization_id, invitation.email, invitation.code].join(':'),
      ).toString('hex');
    },
    createdAt(invitation) {
      return invitation.created_at;
    },
    expiresAt(invitation) {
      return invitation.expires_at;
    },
  },
  OrganizationInvitationError: {
    __isTypeOf(obj) {
      return !!obj.message;
    },
  },
  OrganizationInvitationPayload: {
    __isTypeOf(organization) {
      return !!organization.name;
    },
    name(organization) {
      return organization.name;
    },
  },
  Member: {
    async canLeaveOrganization(member, _, { injector }) {
      const { result } = await injector.get(OrganizationManager).canLeaveOrganization({
        organizationId: member.organization,
        userId: member.id,
      });

      return result;
    },
    isAdmin(member, _, { injector }) {
      return member.isOwner || injector.get(OrganizationManager).isAdminRole(member.role);
    },
  },
  MemberRole: {
    organizationAccessScopes(role) {
      return role.scopes.filter(isOrganizationScope);
    },
    projectAccessScopes(role) {
      return role.scopes.filter(isProjectScope);
    },
    targetAccessScopes(role) {
      return role.scopes.filter(isTargetScope);
    },
    async membersCount(role, _, { injector }) {
      if (role.membersCount) {
        return role.membersCount;
      }

      return injector
        .get(OrganizationManager)
        .getMemberRole({
          organizationId: role.organizationId,
          roleId: role.id,
        })
        .then(r => r?.membersCount ?? 0);
    },
    async canDelete(role, _, { injector }) {
      if (role.locked) {
        return false;
      }

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const currentUserAsMember = await injector.get(OrganizationManager).getOrganizationMember({
        organization: role.organizationId,
        user: currentUser.id,
      });

      const result = await injector
        .get(OrganizationManager)
        .canDeleteRole(role, currentUserAsMember.scopes);

      return result.ok;
    },
    async canUpdate(role, _, { injector }) {
      if (role.locked) {
        return false;
      }
      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const currentUserAsMember = await injector.get(OrganizationManager).getOrganizationMember({
        organization: role.organizationId,
        user: currentUser.id,
      });

      const result = injector
        .get(OrganizationManager)
        .canUpdateRole(role, currentUserAsMember.scopes);

      return result.ok;
    },
    async canInvite(role, _, { injector }) {
      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const currentUserAsMember = await injector.get(OrganizationManager).getOrganizationMember({
        organization: role.organizationId,
        user: currentUser.id,
      });

      const result = injector
        .get(OrganizationManager)
        .canInviteRole(role, currentUserAsMember.scopes);

      return result.ok;
    },
  },
  OrganizationConnection: createConnection(),
};
