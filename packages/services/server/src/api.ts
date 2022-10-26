import { router } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import {
  reservedOrganizationNames,
  organizationAdminScopes,
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '@hive/api';
import type { Storage } from '@hive/api';
import { z } from 'zod';
import { CryptoProvider } from 'packages/services/api/src/modules/shared/providers/crypto';

export async function createContext({ storage, crypto }: { storage: Storage; crypto: CryptoProvider }) {
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
  .query('getOIDCIntegrationById', {
    input: z.object({
      oidcIntegrationId: z.string().min(1),
    }),
    async resolve({ input, ctx }) {
      const result = await ctx.storage.getOIDCIntegrationById({ oidcIntegrationId: input.oidcIntegrationId });
      if (result == null) {
        return null;
      }

      return {
        id: result.id,
        clientId: result.clientId,
        clientSecret: ctx.crypto.decrypt(result.encryptedClientSecret),
        domain: result.domain,
      };
    },
  });

export type InternalApi = typeof internalApiRouter;
