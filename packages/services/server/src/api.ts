import { router } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import { reservedOrganizationNames, organizationAdminScopes } from '@hive/api';
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

export const internalApiRouter = router<Context>()
  .mutation('ensureUser', {
    input: z
      .object({
        superTokensUserId: z.string().min(1),
        email: z.string().min(1),
      })
      .required(),
    resolve({ input, ctx }) {
      return ctx.storage.ensureUserExists({
        ...input,
        reservedOrgNames: reservedOrganizationNames,
        scopes: organizationAdminScopes,
      });
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
