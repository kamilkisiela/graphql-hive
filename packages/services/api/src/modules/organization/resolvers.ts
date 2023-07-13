import { z } from 'zod';
import { createConnection } from '../../shared/schema';
import { AuthManager } from '../auth/providers/auth-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { Logger } from '../shared/providers/logger';
import type { OrganizationModule } from './__generated__/types';
import { OrganizationManager } from './providers/organization-manager';

const OrganizationNameModel = z.string().min(2).max(50);

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
      const CreateOrganizationModel = z.object({
        name: OrganizationNameModel,
      });

      const result = CreateOrganizationModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: 'Please check your input.',
            inputErrors: {
              name: result.error.formErrors.fieldErrors.name?.[0],
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
      const UpdateOrganizationNameModel = z.object({
        name: OrganizationNameModel,
      });

      const result = UpdateOrganizationNameModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message:
              result.error.formErrors.fieldErrors.name?.[0] ??
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
    async deleteOrganizationMembers(_, { selector }, { injector }) {
      const organizationId = await injector.get(IdTranslator).translateOrganizationId(selector);
      const organization = await injector
        .get(OrganizationManager)
        .deleteMembers({ organization: organizationId, users: selector.users });

      return {
        selector,
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
      const InputModel = z.object({
        email: z.string().email(),
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
      const invitation = await injector.get(OrganizationManager).inviteByEmail({
        organization,
        email: input.email,
      });

      return {
        ok: invitation,
      };
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
  },
  OrganizationConnection: createConnection(),
};
