import { router } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import {
  reservedOrganizationNames,
  organizationAdminScopes,
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
  OrganizationType,
} from '@hive/api';
import type { Storage } from '@hive/api';
import { z } from 'zod';
import { CryptoProvider } from 'packages/services/api/src/modules/shared/providers/crypto';

export async function createContext({
  storage,
  crypto,
}: {
  storage: Storage;
  crypto: CryptoProvider;
}) {
  return {
    storage,
    crypto,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

const oidcDefaultScopes = [
  OrganizationAccessScope.READ,
  ProjectAccessScope.READ,
  TargetAccessScope.READ,
  TargetAccessScope.REGISTRY_READ,
];

export const internalApiRouter = router<Context>()
  .mutation('ensureUser', {
    input: z
      .object({
        superTokensUserId: z.string().min(1),
        email: z.string().min(1),
        oidcIntegrationId: z.union([z.string(), z.null()]),
      })
      .required(),
    async resolve({ input, ctx }) {
      const result = await ctx.storage.ensureUserExists({
        ...input,
        reservedOrgNames: reservedOrganizationNames,
        scopes: organizationAdminScopes,
        oidcIntegration: input.oidcIntegrationId
          ? {
              id: input.oidcIntegrationId,
              defaultScopes: oidcDefaultScopes,
            }
          : null,
      });

      return result;
    },
  })
  .query('getDefaultOrgForUser', {
    input: z.object({
      superTokensUserId: z.string(),
      lastOrgId: z.union([z.string(), z.null()]),
    }),
    async resolve({ input, ctx }) {
      const user = await ctx.storage.getUserBySuperTokenId({
        superTokensUserId: input.superTokensUserId,
      });

      // For an OIDC Integration User we want to return the linked organization
      if (user?.oidcIntegrationId) {
        const oidcIntegration = await ctx.storage.getOIDCIntegrationById({
          oidcIntegrationId: user.oidcIntegrationId,
        });
        if (oidcIntegration) {
          const org = await ctx.storage.getOrganization({
            organization: oidcIntegration.linkedOrganizationId,
          });

          return {
            id: org.id,
            cleanId: org.cleanId,
          };
        }
      }

      // This is the organizaton that got stored as an cookie
      // We make sure it actually exists before directing to it.
      if (input.lastOrgId) {
        const org = await ctx.storage.getOrganizationByCleanId({ cleanId: input.lastOrgId });

        if (org) {
          return {
            id: org.id,
            cleanId: org.cleanId,
          };
        }
      }

      if (user?.id) {
        const organizations = await ctx.storage.getOrganizations({ user: user.id });
        const org = organizations?.find(org => org.type === OrganizationType.PERSONAL);

        if (org) {
          return {
            id: org.id,
            cleanId: org.cleanId,
          };
        }
      }

      return null;
    },
  })
  .query('getOIDCIntegrationById', {
    input: z.object({
      oidcIntegrationId: z.string().min(1),
    }),
    async resolve({ input, ctx }) {
      const result = await ctx.storage.getOIDCIntegrationById({
        oidcIntegrationId: input.oidcIntegrationId,
      });
      if (result == null) {
        return null;
      }

      return {
        id: result.id,
        clientId: result.clientId,
        clientSecret: ctx.crypto.decrypt(result.encryptedClientSecret),
        oauthApiUrl: result.oauthApiUrl,
      };
    },
  });

export type InternalApi = typeof internalApiRouter;
