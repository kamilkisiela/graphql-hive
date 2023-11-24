import { OverrideableBuilder } from 'supertokens-js-override/lib/build';
import EmailVerification from 'supertokens-node/recipe/emailverification';
import SessionNode from 'supertokens-node/recipe/session';
import type { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import { TypeInput } from 'supertokens-node/types';
import { env } from '@/env/backend';
import { appInfo } from '@/lib/supertokens/app-info';
import {
  createOIDCSuperTokensProvider,
  getOIDCSuperTokensOverrides,
} from '@/lib/supertokens/third-party-email-password-node-oidc-provider';
import { createThirdPartyEmailPasswordNodeOktaProvider } from '@/lib/supertokens/third-party-email-password-node-okta-provider';
import type { EmailsApi } from '@hive/emails';
import type { InternalApi } from '@hive/server';
import { createTRPCProxyClient, CreateTRPCProxyClient, httpLink } from '@trpc/client';

export const backendConfig = (): TypeInput => {
  const emailsService = createTRPCProxyClient<EmailsApi>({
    links: [httpLink({ url: `${env.emailsEndpoint}/trpc` })],
  });
  const internalApi = createTRPCProxyClient<InternalApi>({
    links: [httpLink({ url: `${env.serverEndpoint}/trpc` })],
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
      }),
    );
  }

  return {
    supertokens: {
      connectionURI: env.supertokens.connectionUri,
      apiKey: env.supertokens.apiKey,
    },
    appInfo: appInfo(),
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
  internalApi: CreateTRPCProxyClient<InternalApi>,
): ThirdPartEmailPasswordTypeInput['override'] => ({
  apis: originalImplementation => ({
    ...originalImplementation,
    emailPasswordSignUpPOST: async input => {
      if (!originalImplementation.emailPasswordSignUpPOST) {
        throw Error('emailPasswordSignUpPOST is not available');
      }

      const response = await originalImplementation.emailPasswordSignUpPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser.mutate({
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
        await internalApi.ensureUser.mutate({
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
          // eslint-disable-next-line prefer-destructuring
          const oidcId: unknown = args.userContext['oidcId'];
          if (typeof oidcId === 'string') {
            return oidcId;
          }
        }
        return null;
      }

      const response = await originalImplementation.thirdPartySignInUpPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser.mutate({
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
