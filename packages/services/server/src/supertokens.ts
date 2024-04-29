import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import { CryptoProvider } from 'packages/services/api/src/modules/shared/providers/crypto';
import { OverrideableBuilder } from 'supertokens-js-override/lib/build/index.js';
import supertokens from 'supertokens-node';
import EmailVerification from 'supertokens-node/recipe/emailverification/index.js';
import SessionNode from 'supertokens-node/recipe/session/index.js';
import type { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword/index.js';
import type { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import type { TypeInput } from 'supertokens-node/types';
import zod from 'zod';
import { HiveError, type Storage } from '@hive/api';
import type { EmailsApi } from '@hive/emails';
import { captureException } from '@sentry/node';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { createInternalApiCaller } from './api';
import { env } from './environment';
import {
  createOIDCSuperTokensProvider,
  getOIDCSuperTokensOverrides,
  type BroadcastOIDCIntegrationLog,
} from './supertokens/oidc-provider';
import { createThirdPartyEmailPasswordNodeOktaProvider } from './supertokens/okta-provider';

const SuperTokenAccessTokenModel = zod.object({
  version: zod.literal('1'),
  superTokensUserId: zod.string(),
  /**
   * Supertokens for some reason omits externalUserId from the access token payload if it is null.
   */
  externalUserId: zod.optional(zod.union([zod.string(), zod.null()])),
  email: zod.string(),
});

export type SupertokensSession = zod.TypeOf<typeof SuperTokenAccessTokenModel>;

export const backendConfig = (requirements: {
  storage: Storage;
  crypto: CryptoProvider;
  logger: FastifyBaseLogger;
  broadcastLog: BroadcastOIDCIntegrationLog;
}): TypeInput => {
  const { logger } = requirements;
  const emailsService = createTRPCProxyClient<EmailsApi>({
    links: [httpLink({ url: `${env.hiveServices.emails?.endpoint}/trpc` })],
  });
  const internalApi = createInternalApiCaller({
    storage: requirements.storage,
    crypto: requirements.crypto,
  });
  const providers: ProviderInput[] = [];

  if (env.auth.github) {
    providers.push({
      config: {
        thirdPartyId: 'github',
        clients: [
          {
            scope: ['read:user', 'user:email'],
            clientId: env.auth.github.clientId,
            clientSecret: env.auth.github.clientSecret,
          },
        ],
      },
    });
  }
  if (env.auth.google) {
    providers.push({
      config: {
        thirdPartyId: 'google',
        clients: [
          {
            clientId: env.auth.google.clientId,
            clientSecret: env.auth.google.clientSecret,
            scope: [
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
              'openid',
            ],
          },
        ],
      },
    });
  }

  if (env.auth.okta) {
    providers.push(createThirdPartyEmailPasswordNodeOktaProvider(env.auth.okta));
  }

  if (env.auth.organizationOIDC) {
    providers.push(
      createOIDCSuperTokensProvider({
        internalApi,
        broadcastLog: requirements.broadcastLog,
        logger,
      }),
    );
  }

  logger.info('SuperTokens providers: %s', providers.map(p => p.config.thirdPartyId).join(', '));
  logger.info('SuperTokens websiteDomain: %s', env.hiveServices.webApp.url);
  logger.info('SuperTokens apiDomain: %s', env.graphql.origin);

  return {
    framework: 'fastify',
    supertokens: {
      connectionURI: env.supertokens.connectionURI,
      apiKey: env.supertokens.apiKey,
    },
    telemetry: false,
    appInfo: {
      // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
      appName: 'GraphQL Hive',
      apiDomain: env.graphql.origin,
      websiteDomain: env.hiveServices.webApp.url,
      apiBasePath: '/auth-api',
      websiteBasePath: '/auth',
    },
    recipeList: [
      ThirdPartyEmailPasswordNode.init({
        providers,
        emailDelivery: {
          override: originalImplementation => ({
            ...originalImplementation,
            async sendEmail(input) {
              if (input.type === 'PASSWORD_RESET') {
                await emailsService.sendPasswordResetEmail.mutate({
                  user: {
                    id: input.user.id,
                    email: input.user.email,
                  },
                  passwordResetLink: input.passwordResetLink,
                });
                return Promise.resolve();
              }

              return Promise.reject(new Error('Unsupported email type.'));
            },
          }),
        },
        override: composeSuperTokensOverrides([
          getEnsureUserOverrides(internalApi),
          env.auth.organizationOIDC ? getOIDCSuperTokensOverrides() : null,
        ]),
      }),
      EmailVerification.init({
        mode: env.auth.requireEmailVerification ? 'REQUIRED' : 'OPTIONAL',
        emailDelivery: {
          override: originalImplementation => ({
            ...originalImplementation,
            async sendEmail(input) {
              if (input.type === 'EMAIL_VERIFICATION') {
                await emailsService.sendEmailVerificationEmail.mutate({
                  user: {
                    id: input.user.id,
                    email: input.user.email,
                  },
                  emailVerifyLink: input.emailVerifyLink,
                });

                return Promise.resolve();
              }
            },
          }),
        },
      }),
      SessionNode.init({
        override: {
          functions: originalImplementation => ({
            ...originalImplementation,
            async createNewSession(input) {
              const user = await ThirdPartyEmailPasswordNode.getUserById(input.userId);

              if (!user) {
                throw new Error(
                  `SuperTokens: Creating a new session failed. Could not find user with id ${input.userId}.`,
                );
              }

              const externalUserId = user.thirdParty
                ? `${user.thirdParty.id}|${user.thirdParty.userId}`
                : null;

              input.accessTokenPayload = {
                version: '1',
                superTokensUserId: input.userId,
                externalUserId,
                email: user.email,
              };

              input.sessionDataInDatabase = {
                version: '1',
                superTokensUserId: input.userId,
                externalUserId,
                email: user.email,
              };

              return originalImplementation.createNewSession(input);
            },
          }),
        },
      }),
    ],
    isInServerlessEnv: true,
  };
};

const getEnsureUserOverrides = (
  internalApi: ReturnType<typeof createInternalApiCaller>,
): ThirdPartEmailPasswordTypeInput['override'] => ({
  apis: originalImplementation => ({
    ...originalImplementation,
    emailPasswordSignUpPOST: async input => {
      if (!originalImplementation.emailPasswordSignUpPOST) {
        throw Error('emailPasswordSignUpPOST is not available');
      }

      const response = await originalImplementation.emailPasswordSignUpPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser({
          superTokensUserId: response.user.id,
          email: response.user.email,
          oidcIntegrationId: null,
        });
      }

      return response;
    },
    async emailPasswordSignInPOST(input) {
      if (originalImplementation.emailPasswordSignInPOST === undefined) {
        throw Error('Should never come here');
      }

      const response = await originalImplementation.emailPasswordSignInPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser({
          superTokensUserId: response.user.id,
          email: response.user.email,
          oidcIntegrationId: null,
        });
      }

      return response;
    },
    async thirdPartySignInUpPOST(input) {
      if (originalImplementation.thirdPartySignInUpPOST === undefined) {
        throw Error('Should never come here');
      }

      function extractOidcId(args: typeof input) {
        if (input.provider.id === 'oidc') {
          const oidcId: unknown = args.userContext['oidcId'];
          if (typeof oidcId === 'string') {
            return oidcId;
          }
        }
        return null;
      }

      const response = await originalImplementation.thirdPartySignInUpPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser({
          superTokensUserId: response.user.id,
          email: response.user.email,
          oidcIntegrationId: extractOidcId(input),
        });
      }

      return response;
    },
    async passwordResetPOST(input) {
      const result = await originalImplementation.passwordResetPOST!(input);

      // For security reasons we revoke all sessions when a password reset is performed.
      if (result.status === 'OK' && result.userId) {
        await SessionNode.revokeAllSessionsForUser(result.userId);
      }

      return result;
    },
  }),
});

const bindObjectFunctions = <T extends { [key: string]: CallableFunction | undefined }>(
  obj: T,
  bindTo: any,
) => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, value?.bind(bindTo)]),
  ) as T;
};

/**
 * Utility function for composing multiple (dynamic SuperTokens overrides).
 */
const composeSuperTokensOverrides = (
  overrides: Array<ThirdPartEmailPasswordTypeInput['override'] | null>,
) => ({
  apis(
    originalImplementation: ReturnType<
      Exclude<Exclude<ThirdPartEmailPasswordTypeInput['override'], undefined>['apis'], undefined>
    >,
    builder: OverrideableBuilder<ThirdPartyEmailPasswordNode.APIInterface> | undefined,
  ) {
    let impl = originalImplementation;
    for (const override of overrides) {
      if (typeof override?.apis === 'function') {
        impl = bindObjectFunctions(override.apis(impl, builder), originalImplementation);
      }
    }
    return impl;
  },
  functions(
    originalImplementation: ReturnType<
      Exclude<
        Exclude<ThirdPartEmailPasswordTypeInput['override'], undefined>['functions'],
        undefined
      >
    >,
  ) {
    let impl = originalImplementation;
    for (const override of overrides) {
      if (typeof override?.functions === 'function') {
        impl = bindObjectFunctions(override.functions(impl), originalImplementation);
      }
    }
    return impl;
  },
});

export function initSupertokens(requirements: {
  storage: Storage;
  crypto: CryptoProvider;
  logger: FastifyBaseLogger;
  broadcastLog: BroadcastOIDCIntegrationLog;
}) {
  supertokens.init(backendConfig(requirements));
}

export async function resolveUser(ctx: { req: FastifyRequest; reply: FastifyReply }) {
  let session: SessionNode.SessionContainer | undefined;

  try {
    session = await SessionNode.getSession(ctx.req, ctx.reply, {
      sessionRequired: false,
      antiCsrfCheck: false,
      checkDatabase: true,
    });
  } catch (error) {
    if (SessionNode.Error.isErrorFromSuperTokens(error)) {
      // Check whether the email is already verified.
      // If it is not then we need to redirect to the email verification page - which will trigger the email sending.
      if (error.type === SessionNode.Error.INVALID_CLAIMS) {
        throw new HiveError('Your account is not verified. Please verify your email address.', {
          extensions: {
            code: 'VERIFY_EMAIL',
          },
        });
      } else if (
        error.type === SessionNode.Error.TRY_REFRESH_TOKEN ||
        error.type === SessionNode.Error.UNAUTHORISED
      ) {
        throw new HiveError('Invalid session', {
          extensions: {
            code: 'NEEDS_REFRESH',
          },
        });
      }
    }

    ctx.req.log.error(error, 'Error while resolving user');
    captureException(error);

    throw error;
  }

  const payload = session?.getAccessTokenPayload();

  if (!payload) {
    return null;
  }

  const result = SuperTokenAccessTokenModel.safeParse(payload);

  if (result.success === false) {
    console.error(`SuperTokens session verification failed.\n` + JSON.stringify(payload));
    throw new HiveError(`Invalid token provided`);
  }

  return result.data;
}
