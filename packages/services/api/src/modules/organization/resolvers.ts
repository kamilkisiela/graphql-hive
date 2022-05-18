import type { OrganizationModule } from './__generated__/types';
import { createConnection } from '../../shared/schema';
import { OrganizationType } from '../../shared/entities';
import { IdTranslator } from '../shared/providers/id-translator';
import { OrganizationManager } from './providers/organization-manager';
import { AuthManager } from '../auth/providers/auth-manager';
import { z } from 'zod';

const OrganizationNameModel = z.string().min(2).max(50);

export const resolvers: OrganizationModule.Resolvers = {
  Query: {
    async organization(_, { selector }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);

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
      const organization = await injector
        .get(OrganizationManager)
        .getOrganizationByInviteCode({
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
      const organization = await injector
        .get(OrganizationManager)
        .createOrganization({
          name: input.name,
          type: OrganizationType.REGULAR,
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
      const organization = await injector
        .get(OrganizationManager)
        .deleteOrganization({
          organization: organizationId,
        });
      return {
        selector: {
          organization: organizationId,
        },
        organization,
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

      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId(input);

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
      const organization = await injector
        .get(OrganizationManager)
        .joinOrganization({ code });

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
    async resetInviteCode(_, { selector }, { injector }) {
      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);
      const organizationManager = injector.get(OrganizationManager);
      const organization = organizationManager.resetInviteCode({
        organization: organizationId,
      });

      return {
        selector,
        organization,
      };
    },
    async deleteOrganizationMembers(_, { selector }, { injector }) {
      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId(selector);
      const organization = await injector
        .get(OrganizationManager)
        .deleteMembers({ organization: organizationId, users: selector.users });

      return {
        selector,
        organization,
      };
    },
    async updateOrganizationMemberAccess(_, { input }, { injector }) {
      const organization = await injector
        .get(IdTranslator)
        .translateOrganizationId(input);

      return {
        selector: {
          organization: input.organization,
        },
        organization: await injector
          .get(OrganizationManager)
          .updateMemberAccess({
            organization,
            user: input.user,
            organizationScopes: input.organizationScopes,
            projectScopes: input.projectScopes,
            targetScopes: input.targetScopes,
          }),
      };
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

      return members.find((m) => m.id === me.id)!;
    },
    members(organization, _, { injector }) {
      return injector
        .get(OrganizationManager)
        .getOrganizationMembers({ organization: organization.id });
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
  OrganizationConnection: createConnection(),
};
