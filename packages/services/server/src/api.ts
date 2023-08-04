import { CryptoProvider } from 'packages/services/api/src/modules/shared/providers/crypto';
import { z } from 'zod';
import type { Storage } from '@hive/api';
import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@hive/api';
import { FastifyRequest, handleTRPCError } from '@hive/service-common';
import type { inferAsyncReturnType } from '@trpc/server';
import { initTRPC } from '@trpc/server';

export async function createContext({
  storage,
  crypto,
  req,
}: {
  storage: Storage;
  crypto: CryptoProvider;
  req: FastifyRequest;
}) {
  return {
    storage,
    crypto,
    req,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

const oidcDefaultScopes = [
  OrganizationAccessScope.READ,
  ProjectAccessScope.READ,
  TargetAccessScope.READ,
  TargetAccessScope.REGISTRY_READ,
];

const t = initTRPC.context<Context>().create();
const errorMiddleware = t.middleware(handleTRPCError);
const procedure = t.procedure.use(errorMiddleware);

export const internalApiRouter = t.router({
  ensureUser: procedure
    .input(
      z
        .object({
          superTokensUserId: z.string().min(1),
          email: z.string().min(1),
          oidcIntegrationId: z.union([z.string(), z.null()]),
        })
        .required(),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.storage.ensureUserExists({
        ...input,
        oidcIntegration: input.oidcIntegrationId
          ? {
              id: input.oidcIntegrationId,
              defaultScopes: oidcDefaultScopes,
            }
          : null,
      });

      return result;
    }),
  getDefaultOrgForUser: procedure
    .input(
      z.object({
        superTokensUserId: z.string(),
        lastOrgId: z.union([z.string(), z.null()]),
      }),
    )
    .query(async ({ input, ctx }) => {
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
        const allAllOraganizations = await ctx.storage.getOrganizations({ user: user.id });

        if (allAllOraganizations.length > 0) {
          const someOrg = allAllOraganizations[0];

          return {
            id: someOrg.id,
            cleanId: someOrg.cleanId,
          };
        }
      }

      return null;
    }),
  getOIDCIntegrationById: procedure
    .input(
      z.object({
        oidcIntegrationId: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (z.string().uuid().safeParse(input.oidcIntegrationId).success === false) {
        return null;
      }

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
        tokenEndpoint: result.tokenEndpoint,
        userinfoEndpoint: result.userinfoEndpoint,
        authorizationEndpoint: result.authorizationEndpoint,
      };
    }),
});

export type InternalApi = typeof internalApiRouter;
