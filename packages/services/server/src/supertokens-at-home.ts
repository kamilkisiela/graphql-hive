import { FastifyReply, type FastifyInstance } from 'fastify';
import * as oidClient from 'openid-client';
import z from 'zod';
import cookie from '@fastify/cookie';
import { Storage, User } from '@hive/api';
import {
  AccessTokenKeyContainer,
  comparePassword,
  createAccessToken,
  createFrontToken,
  createRefreshToken,
  getPasswordResetHash,
  hashPassword,
  parseRefreshToken,
  sha256,
} from '@hive/api/modules/auth/lib/supertokens-at-home/crypto';
import { OAuthCache } from '@hive/api/modules/auth/providers/oauth-cache';
import {
  EmailPasswordOrThirdPartyUser,
  SuperTokensStore,
} from '@hive/api/modules/auth/providers/supertokens-store';
import { OIDCIntegrationStore } from '@hive/api/modules/oidc-integrations/providers/oidc-integration.store';
import { ProvisionedUsersStore } from '@hive/api/modules/organization/providers/provisioned-users-store';
import { RedisRateLimiter } from '@hive/api/modules/shared/providers/redis-rate-limiter';
import type { OIDCIntegration } from '@hive/api/shared/entities';
import { Encryptor } from '@hive/service-common';
import { TaskScheduler } from '@hive/workflows/kit';
import { PasswordResetTask } from '@hive/workflows/tasks/password-reset';
import { env } from './environment';
import { createBrokerFetch } from './oauth-fetch';
import { createNewSession, validatePassword } from './supertokens-at-home/shared';
import type { WorkloadIdentityFederationProvider } from './workload-identity-federation';

type BroadcastOIDCIntegrationLog = (oidcOrganizationId: string, message: string) => void;

const oauthFetch = createBrokerFetch(fetch, env.requestBroker);

/**
 * Registers the routes of the Supertokens at Home implementation to a fastify instance.
 */
export async function registerSupertokensAtHome(
  server: FastifyInstance,
  storage: Storage,
  oidcIntegrations: OIDCIntegrationStore,
  taskScheduler: TaskScheduler,
  crypto: Encryptor,
  rateLimiter: RedisRateLimiter,
  oauthCache: OAuthCache,
  broadcastLog: BroadcastOIDCIntegrationLog,
  secrets: {
    refreshTokenKey: string;
    accessTokenKey: string;
  },
  workloadIdentityFederation: WorkloadIdentityFederationProvider | null,
  isSCIMEnabled: boolean,
) {
  const supertokensStore = new SuperTokensStore(storage.pool, server.log);

  const accessTokenKey = new AccessTokenKeyContainer(secrets.accessTokenKey);

  await server.register(cookie, {
    hook: 'onRequest',
    parseOptions: {},
  });

  function unsetAuthCookies(reply: FastifyReply) {
    return reply
      .setCookie('sRefreshToken', '', {
        httpOnly: true,
        secure: true,
        path: '/auth-api/session/refresh',
        sameSite: 'lax',
        expires: new Date(0),
      })
      .setCookie('sAccessToken', '', {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'lax',
        expires: new Date(0),
      });
  }

  /** Verify whether the domain is allowed to do non-oidc sign in */
  async function isNonOIDCSignUpAllowedForEmailAddress(
    email: string,
    user: EmailPasswordOrThirdPartyUser | null,
  ) {
    const [, emailDomain] = email.split('@');
    const verifiedDomain = await oidcIntegrations.findVerifiedDomainByName(emailDomain);

    if (!verifiedDomain) {
      return {
        type: 'success' as const,
      };
    }

    const oidcIntegration = await storage.getOIDCIntegrationById({
      oidcIntegrationId: verifiedDomain.oidcIntegrationId,
    });

    if (!oidcIntegration?.oidcForVerifiedDomainsRequired) {
      return {
        type: 'success' as const,
      };
    }

    if (!user) {
      return {
        type: 'error' as const,
      };
    }

    const isUserAdminOfOrganization = await new ProvisionedUsersStore(
      storage.pool,
    ).isIdentityAdminOfOrganization(user.userId, oidcIntegration.linkedOrganizationId);

    if (!isUserAdminOfOrganization) {
      return {
        type: 'error' as const,
      };
    }

    return {
      type: 'success' as const,
    };
  }

  const OIDCIdLookupSchema = z.object({
    slug: z.string({
      required_error: 'Slug is required',
    }),
  });

  server.post('/auth-api/oidc-id-lookup', async (req, res) => {
    if (await rateLimiter.isFastifyRouteRateLimited(req)) {
      return res.send({
        ok: false,
        title: 'Rate Limited',
        description: 'Please try again later.',
        status: 400,
      });
    }

    req.log.debug('Looking up OIDC integration ID');
    const inputResult = OIDCIdLookupSchema.safeParse(req.body);

    if (!inputResult.success) {
      req.log.debug('Invalid body sent. Failed to parse slug.');
      return res.status(400).send({
        ok: false,
        title: 'Invalid input',
        description: 'Failed to resolve SSO information due to invalid input.',
        status: 400,
      });
    }

    req.log.debug('Parsed slug (slug=%s)', inputResult.data.slug);

    const oidcId = await storage.getOIDCIntegrationIdForOrganizationSlug({
      slug: inputResult.data.slug,
    });

    if (!oidcId) {
      req.log.debug('No SSO integration found (slug=%s)', inputResult.data.slug);
      return res.status(404).send({
        ok: false,
        title: 'SSO integration not found',
        description: 'Your organization lacks an SSO integration or it does not exist.',
        status: 404,
      });
    }

    return res.status(200).send({
      ok: true,
      id: oidcId,
    });
  });

  server.route({
    url: '/auth-api/signout',
    method: 'POST',
    handler(_, rep) {
      return unsetAuthCookies(rep)
        .header('front-token', 'remove')
        .header('Access-Control-Expose-Headers', 'front-token')
        .send({
          status: 'OK',
        });
    },
  });

  server.route({
    url: '/auth-api/signup',
    method: 'POST',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Please try again later.',
        });
      }

      const parsedBody = SignUpBodyModel.safeParse(req.body);

      if (!parsedBody.success) {
        return rep.send(401);
      }

      const firstName =
        parsedBody.data.formFields.find(field => field.id === 'firstName')?.value ?? null;
      const lastName =
        parsedBody.data.formFields.find(field => field.id === 'lastName')?.value ?? null;
      const rawEmail = parsedBody.data.formFields.find(field => field.id === 'email')?.value ?? '';
      const password =
        parsedBody.data.formFields.find(field => field.id === 'password')?.value ?? '';

      const emailResult = z.string().email().toLowerCase().safeParse(rawEmail);

      // Verify email
      if (!emailResult.success) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Invalid email provided.',
        });
      }

      // Lookup user
      let user = await supertokensStore.lookupEmailUserByEmail(rawEmail);

      if (user) {
        return rep.send({
          status: 'FIELD_ERROR',
          formFields: [
            {
              id: 'email',
              error: 'This email already exists. Please sign in instead.',
            },
          ],
        });
      }

      const result = await isNonOIDCSignUpAllowedForEmailAddress(emailResult.data, user);

      if (result.type === 'error') {
        return rep.send({
          status: 'SIGN_UP_NOT_ALLOWED',
          reason: 'Please sign in through your organizations identity provider.',
        });
      }

      const passwordValidation = validatePassword(password);

      if (passwordValidation.status === 'INVALID') {
        return rep.send({
          status: 'FIELD_ERROR',
          formFields: [
            {
              id: 'password',
              error: passwordValidation.message,
            },
          ],
        });
      }

      // hash password
      const passwordHash = await hashPassword(password);

      // create user
      user = await supertokensStore.createEmailPasswordUser({
        email: emailResult.data,
        passwordHash,
      });

      const ensureUserResult = await storage.ensureUserExists({
        superTokensUserId: user.userId,
        email: emailResult.data,
        oidcIntegration: null,
        firstName,
        lastName,
      });

      if (ensureUserResult.ok === false) {
        return rep.send({
          status: 'SIGN_UP_NOT_ALLOWED',
          reason: 'Not allowed.',
        });
      }

      const { session, accessToken, refreshToken } = await createNewSession(
        supertokensStore,
        {
          hiveUser: ensureUserResult.user,
          oidcIntegrationId: null,
          superTokensUserId: user.userId,
        },
        {
          refreshTokenKey: secrets.refreshTokenKey,
          accessTokenKey,
        },
      );
      const frontToken = createFrontToken({
        superTokensUserId: user.userId,
        accessToken,
      });

      return rep
        .setCookie('sRefreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          path: '/auth-api/session/refresh',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .setCookie('sAccessToken', accessToken.token, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .header('front-token', frontToken)
        .header('access-control-expose-headers', 'front-token')
        .send({
          status: 'OK',
          user: {
            id: user.userId,
            isPrimaryUser: false,
            tenantIds: ['public'],
            timeJoined: user.timeJoined,
            emails: [user.email],
            phoneNumbers: [],
            thirdParty: [],
            loginMethods: [
              {
                tenantIds: ['public'],
                recipeUserId: user.userId,
                verified: false,
                timeJoined: user.timeJoined,
                recipeId: 'emailpassword',
                email: user.email,
              },
            ],
          },
        });
    },
  });

  server.route({
    url: '/auth-api/signin',
    method: 'POST',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Please try again later.',
        });
      }

      const parsedBody = SignInBodyModel.safeParse(req.body);

      if (!parsedBody.success) {
        return rep.send(401);
      }

      const email =
        parsedBody.data.formFields.find(field => field.id === 'email')?.value.toLowerCase() ?? '';
      const password =
        parsedBody.data.formFields.find(field => field.id === 'password')?.value ?? '';

      const user = await supertokensStore.findEmailPasswordUserByEmail(email);

      if (!user) {
        return rep.send({
          status: 'WRONG_CREDENTIALS_ERROR',
        });
      }

      const emailResult = await isNonOIDCSignUpAllowedForEmailAddress(email, user);

      if (emailResult.type === 'error') {
        return rep.send({
          status: 'SIGN_IN_NOT_ALLOWED',
          reason: 'Please sign in through your organizations identity provider.',
        });
      }

      const passwordMatch = await comparePassword(password, user.passwordHash);

      if (!passwordMatch) {
        return rep.send({
          status: 'WRONG_CREDENTIALS_ERROR',
        });
      }

      const result = await storage.ensureUserExists({
        superTokensUserId: user.userId,
        email: user.email,
        oidcIntegration: null,
        // They are not available during sign in.
        firstName: null,
        lastName: null,
      });

      if (!result.ok) {
        return rep.send({
          status: 'SIGN_IN_NOT_ALLOWED',
          reason: result.reason,
        });
      }

      const { session, refreshToken, accessToken } = await createNewSession(
        supertokensStore,
        {
          hiveUser: result.user,
          oidcIntegrationId: null,
          superTokensUserId: user.userId,
        },
        {
          refreshTokenKey: secrets.refreshTokenKey,
          accessTokenKey,
        },
      );
      const frontToken = createFrontToken({
        superTokensUserId: user.userId,
        accessToken,
      });

      return rep
        .setCookie('sRefreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          path: '/auth-api/session/refresh',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .setCookie('sAccessToken', accessToken.token, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .header('front-token', frontToken)
        .header('access-control-expose-headers', 'front-token')
        .send({
          status: 'OK',
          user: {
            id: user.userId,
            isPrimaryUser: false,
            tenantIds: ['public'],
            timeJoined: user.timeJoined,
            emails: [user.email],
            phoneNumbers: [],
            thirdParty: [],
            loginMethods: [
              {
                tenantIds: ['public'],
                recipeUserId: user.userId,
                verified: false,
                timeJoined: user.timeJoined,
                recipeId: 'emailpassword',
                email: user.email,
              },
            ],
          },
        });
    },
  });

  server.route({
    url: '/auth-api/user/password/reset/token',
    method: 'POST',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Please try again later.',
        });
      }

      const parsedBody = UserPasswordResetTokenBodyModel.safeParse(req.body);

      if (!parsedBody.success) {
        return rep.send(401);
      }

      const email =
        parsedBody.data.formFields.find(field => field.id === 'email')?.value.toLowerCase() ?? '';

      const user = await supertokensStore.findEmailPasswordUserByEmail(email);

      if (!user) {
        req.log.debug('User not found via email.');
        return rep.send({
          status: 'OK',
        });
      }

      const token = getPasswordResetHash();

      await supertokensStore.createEmailPasswordResetToken({
        user,
        token: sha256(token),
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      const passwordResetLink = new URL(env.hiveServices.webApp.url);
      passwordResetLink.pathname = '/auth/reset-password';
      passwordResetLink.searchParams.set('rid', 'thirdpartyemailpassword');
      passwordResetLink.searchParams.set('tenantId', 'public');
      passwordResetLink.searchParams.set('token', token);

      await taskScheduler.scheduleTask(PasswordResetTask, {
        user: {
          id: 'noop',
          email: user.email,
        },
        passwordResetLink: passwordResetLink.toString(),
      });

      return rep.status(200).send({
        status: 'OK',
      });
    },
  });

  server.route({
    url: '/auth-api/user/password/reset',
    method: 'POST',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Please try again later.',
        });
      }

      const parsedBody = UserPasswordResetBodyModel.safeParse(req.body);

      if (!parsedBody.success) {
        return rep.status(401).send();
      }

      const newPassword =
        parsedBody.data.formFields.find(field => field.id === 'password')?.value ?? '';

      const passwordValidation = validatePassword(newPassword);

      if (passwordValidation.status === 'INVALID') {
        return rep.send({
          status: 'FIELD_ERROR',
          formFields: [
            {
              id: 'password',
              error: passwordValidation.message,
            },
          ],
        });
      }

      const token = sha256(parsedBody.data.token);
      const newPasswordHash = await hashPassword(newPassword);

      const result = await supertokensStore.updateEmailPasswordBasedOnResetToken({
        token,
        newPasswordHash,
      });

      if (!result) {
        return rep.send({
          status: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
        });
      }

      return rep.send({
        status: 'OK',
      });
    },
  });

  server.route({
    url: '/auth-api/session/refresh',
    method: 'POST',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.status(401).send();
      }

      const refreshToken = req.cookies?.['sRefreshToken'] ?? null;

      if (!refreshToken) {
        req.log.debug('No refresh token provided.');
        return rep.status(404).send();
      }

      const parseResult = await parseRefreshToken(refreshToken, secrets.refreshTokenKey);

      if (parseResult.type === 'error') {
        req.log.debug('Wrong refresh token version provided. err=%s', parseResult.code);
        return unsetAuthCookies(rep).status(404).send();
      }

      const { payload } = parseResult;

      // 1. lookup refresh token based on hash and check if it is invalid or rejected
      const session = await supertokensStore.getSessionInfo(payload.sessionHandle);

      if (!session) {
        req.log.debug('The referenced session does not exist.');
        return unsetAuthCookies(rep).status(404).send();
      }

      if (session.expiresAt < Date.now()) {
        req.log.debug('The session has expired.');
        await supertokensStore.deleteSession(session.sessionHandle);
        return unsetAuthCookies(rep).status(404).send();
      }

      if (
        !payload.parentRefreshTokenHash1 &&
        sha256(sha256(refreshToken)) !== session.refreshTokenHash2
      ) {
        req.log.debug('The refreshTokenHash2 does not match (first refresh).');
        await supertokensStore.deleteSession(session.sessionHandle);
        return unsetAuthCookies(rep).status(404).send();
      }

      if (
        payload.parentRefreshTokenHash1 &&
        session.refreshTokenHash2 !== sha256(payload.parentRefreshTokenHash1)
      ) {
        req.log.debug('The refreshTokenHash2 does not match.');
        await supertokensStore.deleteSession(session.sessionHandle);
        return unsetAuthCookies(rep).status(404).send();
      }

      // 2. create a new refresh token
      const parentTokenHash = sha256(refreshToken);

      const newRefreshToken = createRefreshToken(
        {
          sessionHandle: session.sessionHandle,
          userId: session.userId,
          parentRefreshTokenHash1: sha256(refreshToken),
        },
        secrets.refreshTokenKey,
      );

      // 2,5. store new parentTokenHash in DB
      const updatedSession = await supertokensStore.updateSessionRefreshHash(
        session.sessionHandle,
        session.refreshTokenHash2,
        sha256(parentTokenHash),
      );

      if (!updatedSession) {
        req.log.debug(
          'The session has expired (another refresh for the same access token was completed, while this request was in flight).',
        );
        await supertokensStore.deleteSession(session.sessionHandle);
        return unsetAuthCookies(rep).status(404).send();
      }

      // 3. create a new access token
      const accessToken = createAccessToken(
        {
          sub: session.userId,
          sessionHandle: session.sessionHandle,
          sessionData: JSON.parse(session.sessionData),
          refreshTokenHash1: sha256(newRefreshToken),
          parentRefreshTokenHash1: parentTokenHash,
        },
        accessTokenKey,
      );

      const frontToken = createFrontToken({
        superTokensUserId: session.userId,
        accessToken,
      });

      return rep
        .setCookie('sRefreshToken', newRefreshToken, {
          httpOnly: true,
          secure: true,
          path: '/auth-api/session/refresh',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .setCookie('sAccessToken', accessToken.token, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .header('front-token', frontToken)
        .header('access-control-expose-headers', 'front-token')
        .send();
    },
  });

  server.route({
    url: '/auth-api/authorisationurl',
    method: 'GET',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Please try again later.',
        });
      }
      const query = AuthorisationurlQueryParamsModel.safeParse(req.query);

      if (!query.success) {
        req.log.debug('Invalid input provided.');
        return rep.status(200).send({
          status: 'GENERAL_ERROR',
          message: 'Something went wrong.',
        });
      }

      if (query.data.thirdPartyId === 'github') {
        if (!env.auth.github) {
          req.log.debug('The github provider is not enabled.');
          return rep.status(200).send({
            status: 'GENERAL_ERROR',
            message: 'Method not supported.',
          });
        }

        const pkceVerifier = oidClient.randomPKCECodeVerifier();
        const codeChallenge = await oidClient.calculatePKCECodeChallenge(pkceVerifier);

        const redirectUrl = new URL(env.hiveServices.webApp.url);
        redirectUrl.pathname = '/auth/callback/github';
        const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
        authorizeUrl.searchParams.set('client_id', env.auth.github.clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUrl.toString());
        authorizeUrl.searchParams.set('scope', ['read:user', 'user:email'].join(' '));
        authorizeUrl.searchParams.set('code_challenge', codeChallenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        const state = await oauthCache.put({
          method: 'github',
          oidIntegrationId: null,
          pkceVerifier,
        });
        authorizeUrl.searchParams.set('state', state);

        return rep.send({
          status: 'OK',
          urlWithQueryParams: authorizeUrl.toString(),
        });
      }
      if (query.data.thirdPartyId === 'google') {
        if (!env.auth.google) {
          req.log.debug('The google provider is not enabled.');
          return rep.status(200).send({
            status: 'GENERAL_ERROR',
            message: 'Method not supported.',
          });
        }

        const pkceVerifier = oidClient.randomPKCECodeVerifier();
        const codeChallenge = await oidClient.calculatePKCECodeChallenge(pkceVerifier);

        const redirectUrl = new URL(env.hiveServices.webApp.url);
        redirectUrl.pathname = '/auth/callback/google';
        const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authorizeUrl.searchParams.set('client_id', env.auth.google.clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUrl.toString());
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set(
          'scope',
          [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'openid',
          ].join(' '),
        );
        authorizeUrl.searchParams.set('code_challenge', codeChallenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        const state = await oauthCache.put({
          method: 'google',
          oidIntegrationId: null,
          pkceVerifier,
        });
        authorizeUrl.searchParams.set('state', state);

        return rep.send({
          status: 'OK',
          urlWithQueryParams: authorizeUrl.toString(),
        });
      }
      if (query.data.thirdPartyId === 'okta') {
        if (!env.auth.okta) {
          req.log.debug('The okta provider is not enabled.');
          return rep.status(200).send({
            status: 'GENERAL_ERROR',
            message: 'Method not supported.',
          });
        }

        const pkceVerifier = oidClient.randomPKCECodeVerifier();
        const codeChallenge = await oidClient.calculatePKCECodeChallenge(pkceVerifier);

        const redirectUrl = new URL(env.hiveServices.webApp.url);
        redirectUrl.pathname = '/auth/callback/okta';
        const authorizeUrl = new URL(env.auth.okta.endpoint);
        authorizeUrl.pathname = '/oauth2/v1/authorize';

        authorizeUrl.searchParams.set('client_id', env.auth.okta.clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUrl.toString());
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set(
          'scope',
          ['openid', 'email', 'profile', 'okta.users.read.self'].join(' '),
        );
        authorizeUrl.searchParams.set('code_challenge', codeChallenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        const state = await oauthCache.put({
          method: 'okta',
          oidIntegrationId: null,
          pkceVerifier,
        });
        authorizeUrl.searchParams.set('state', state);

        return rep.send({
          status: 'OK',
          urlWithQueryParams: authorizeUrl.toString(),
        });
      }
      if (query.data.thirdPartyId === 'oidc') {
        if (!query.data.oidc_id) {
          req.log.debug('Missing oidc_id parameter.');
          return rep.status(200).send({
            status: 'GENERAL_ERROR',
            message: 'Something went wrong.',
          });
        }

        if (!z.string().uuid().safeParse(query.data.oidc_id).success) {
          return rep.status(200).send({
            status: 'GENERAL_ERROR',
            message: 'Something went wrong. Please try again',
          });
        }

        const oidcIntegration = await storage.getOIDCIntegrationById({
          oidcIntegrationId: query.data.oidc_id,
        });

        if (!oidcIntegration) {
          return rep.status(200).send({
            status: 'GENERAL_ERROR',
            message: 'Something went wrong. Please try again',
          });
        }

        const scopes = new Set(['openid', 'email', ...oidcIntegration.additionalScopes]);

        const useFederation =
          workloadIdentityFederation !== null &&
          (env.oidcWorkloadFederation?.organizationIds.includes(
            oidcIntegration.linkedOrganizationId,
          ) ??
            false);

        const oidClientConfig = new oidClient.Configuration(
          {
            issuer: 'noop',
            authorization_endpoint: oidcIntegration.authorizationEndpoint,
            userinfo_endpoint: oidcIntegration.userinfoEndpoint,
            token_endpoint: oidcIntegration.tokenEndpoint,
          },
          oidcIntegration.clientId,
          useFederation
            ? undefined
            : {
                client_secret: crypto.decrypt(oidcIntegration.encryptedClientSecret),
              },
        );
        oidClient.allowInsecureRequests(oidClientConfig);

        const redirect_uri = new URL(env.hiveServices.webApp.url);
        redirect_uri.pathname = '/auth/callback/oidc';

        const pkceVerifier = oidClient.randomPKCECodeVerifier();
        const codeChallenge = await oidClient.calculatePKCECodeChallenge(pkceVerifier);

        let parameters: Record<string, string> = {
          redirect_uri: redirect_uri.toString(),
          scope: Array.from(scopes).join(' '),
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        };

        let redirectTo = oidClient.buildAuthorizationUrl(oidClientConfig, parameters);
        const state = await oauthCache.put({
          method: 'oidc',
          oidIntegrationId: oidcIntegration.id,
          pkceVerifier,
        });
        redirectTo.searchParams.set('state', state);

        broadcastLog(
          oidcIntegration.id,
          `redirect client to oauth provider ${redirectTo.toString()}`,
        );

        return rep.send({
          status: 'OK',
          urlWithQueryParams: redirectTo.toString(),
        });
      }

      req.log.debug('unknown login method %s', query.data.thirdPartyId);
      return rep.status(200).send({
        status: 'GENERAL_ERROR',
        message: 'Something went wrong.',
      });
    },
  });

  server.route({
    url: '/auth-api/signinup',
    method: 'POST',
    async handler(req, rep) {
      if (await rateLimiter.isFastifyRouteRateLimited(req)) {
        return rep.send({
          status: 'GENERAL_ERROR',
          message: 'Please try again later.',
        });
      }

      const parsedBody = ThirdPartySigninupModel.safeParse(req.body);

      if (!parsedBody.success) {
        req.log.debug('Invalid body provided.');
        return rep.status(200).send({
          status: 'SIGN_IN_UP_NOT_ALLOWED',
          reason: 'Please try again.',
        });
      }

      let supertokensUser: EmailPasswordOrThirdPartyUser;
      let hiveUser: User;
      let oidcIntegration: OIDCIntegration | null = null;

      if (parsedBody.data.thirdPartyId === 'github') {
        if (!env.auth.github) {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'GitHub sign in is not allowed.',
          });
        }

        const state = parsedBody.data.redirectURIInfo.redirectURIQueryParams.state ?? '';

        const cacheRecord = await oauthCache.get(state);

        if (cacheRecord?.method !== 'github') {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please try again.',
          });
        }

        const accessTokenUrl = new URL('https://github.com/login/oauth/access_token');

        const AccessTokenResponseBodyModel = z.object({
          access_token: z.string(),
          scope: z.string(),
        });

        const accessTokenResponse = await oauthFetch(accessTokenUrl.toString(), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: env.auth.github.clientId,
            client_secret: env.auth.github.clientSecret,
            code: parsedBody.data.redirectURIInfo.redirectURIQueryParams.code,
            redirect_uri: parsedBody.data.redirectURIInfo.redirectURIOnProviderDashboard,
            code_verifier: cacheRecord.pkceVerifier,
          }),
        });

        if (accessTokenResponse.status !== 200) {
          req.log.debug('Received invalid response status from github.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Something went wrong.',
          });
        }

        const accessTokenBody = await accessTokenResponse
          .json()
          .then(res => AccessTokenResponseBodyModel.parse(res));

        const UserInfoResponseModel = z.object({
          id: z.number(),
        });

        const userInfoResponse = await oauthFetch('https://api.github.com/user', {
          method: 'GET',
          headers: {
            accept: 'application/vnd.github+json',
            'x-gitHub-api-version': '2022-11-28',
            authorization: `Bearer ${accessTokenBody.access_token}`,
          },
        });

        if (userInfoResponse.status !== 200) {
          req.log.debug('Received invalid response status from github user lookup.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Something went wrong.',
          });
        }

        const userInfoBody = await userInfoResponse
          .json()
          .then(res => UserInfoResponseModel.parse(res));

        const EmailsBodyModel = z.array(
          z.object({
            email: z.string(),
            verified: z.boolean(),
            primary: z.boolean(),
          }),
        );

        let user = await supertokensStore.findThirdPartyUser({
          thirdPartyId: 'github',
          thirdPartyUserId: String(userInfoBody.id),
        });

        const emailsResponse = await oauthFetch('https://api.github.com/user/emails', {
          method: 'GET',
          headers: {
            accept: 'application/vnd.github+json',
            'x-gitHub-api-version': '2022-11-28',
            authorization: `Bearer ${accessTokenBody.access_token}`,
          },
        });

        if (emailsResponse.status !== 200) {
          req.log.debug('Received invalid response status from github email lookup.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Something went wrong.',
          });
        }

        const emailsBody = await emailsResponse.json().then(res => EmailsBodyModel.parse(res));

        const email = emailsBody.find(email => email.primary) ?? null;

        if (!email) {
          req.log.debug('Failed to find primary email address from GitHub API.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Something went wrong.',
          });
        }

        const emailResult = await isNonOIDCSignUpAllowedForEmailAddress(email.email, user);

        if (emailResult.type === 'error') {
          return rep.send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please sign in through your organizations identity provider.',
          });
        }

        if (!user) {
          user = await supertokensStore.createThirdPartyUser({
            email: email?.email,
            thirdPartyId: 'github',
            thirdPartyUserId: String(userInfoBody.id),
          });
        }

        const ensureUserExists = await storage.ensureUserExists({
          superTokensUserId: user.userId,
          email: user.email,
          firstName: null,
          lastName: null,
          oidcIntegration: null,
        });

        if (!ensureUserExists.ok) {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in not allowed.',
          });
        }

        supertokensUser = user;
        hiveUser = ensureUserExists.user;
      } else if (parsedBody.data.thirdPartyId === 'google') {
        if (!env.auth.google) {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'GitHub sign in is not allowed.',
          });
        }

        const state = parsedBody.data.redirectURIInfo.redirectURIQueryParams.state ?? '';

        const cacheRecord = await oauthCache.get(state);

        if (cacheRecord?.method !== 'google') {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please try again.',
          });
        }

        const accessTokenUrl = new URL('https://oauth2.googleapis.com/token');

        const AccessTokenResponseBodyModel = z.object({
          access_token: z.string(),
          scope: z.string(),
        });

        const accessTokenResponse = await oauthFetch(accessTokenUrl.toString(), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: env.auth.google.clientId,
            client_secret: env.auth.google.clientSecret,
            code: parsedBody.data.redirectURIInfo.redirectURIQueryParams.code,
            redirect_uri: parsedBody.data.redirectURIInfo.redirectURIOnProviderDashboard,
            code_verifier: cacheRecord.pkceVerifier,
          }),
        });

        if (accessTokenResponse.status !== 200) {
          req.log.debug(
            'Received invalid response status from google. %s',
            await accessTokenResponse.text(),
          );
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Something went wrong.',
          });
        }

        const accessTokenBody = await accessTokenResponse
          .json()
          .then(res => AccessTokenResponseBodyModel.parse(res));

        const UserInfoBodyModel = z.object({
          sub: z.string(),
          email: z.string(),
        });

        const userInfoResponse = await oauthFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${accessTokenBody.access_token}`,
          },
        });

        if (userInfoResponse.status !== 200) {
          req.log.debug('Received invalid response status from google user info endpoint.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Something went wrong.',
          });
        }

        const userInfo = await userInfoResponse.json().then(UserInfoBodyModel.parse);

        let user = await supertokensStore.findThirdPartyUser({
          thirdPartyId: 'google',
          thirdPartyUserId: String(userInfo.sub),
        });

        const emailResult = await isNonOIDCSignUpAllowedForEmailAddress(userInfo.email, user);

        if (emailResult.type === 'error') {
          return rep.send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please sign in through your organizations identity provider.',
          });
        }

        if (!user) {
          user = await supertokensStore.createThirdPartyUser({
            thirdPartyId: 'google',
            thirdPartyUserId: userInfo.sub,
            email: userInfo.email,
          });
        }

        const ensureUserExists = await storage.ensureUserExists({
          superTokensUserId: user.userId,
          email: user.email,
          firstName: null,
          lastName: null,
          oidcIntegration: null,
        });

        if (!ensureUserExists.ok) {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in not allowed.',
          });
        }

        supertokensUser = user;
        hiveUser = ensureUserExists.user;
      } else if (parsedBody.data.thirdPartyId === 'okta') {
        if (!env.auth.okta) {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Okta sign in is not allowed.',
          });
        }

        const state = parsedBody.data.redirectURIInfo.redirectURIQueryParams.state ?? '';

        const cacheRecord = await oauthCache.get(state);

        if (cacheRecord?.method !== 'okta') {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please try again.',
          });
        }

        const current_url = new URL(env.hiveServices.webApp.url);
        current_url.pathname = '/auth/callback/okta';

        const GrantResponseModel = z.object({
          access_token: z.string(),
        });

        const grantResponse = await oauthFetch(env.auth.okta.endpoint + '/oauth2/v1/token', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code_verifier: cacheRecord.pkceVerifier,
            code: parsedBody.data.redirectURIInfo.redirectURIQueryParams.code ?? '',
            redirect_uri: current_url.toString(),
            client_id: env.auth.okta.clientId,
            client_secret: env.auth.okta.clientSecret,
          }),
        });

        if (grantResponse.status != 200) {
          req.log.debug(
            'received non 200 status from token endpoint %d %s',
            grantResponse.status,
            await grantResponse.text(),
          );
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const grantResponseRaw = await grantResponse.text();
        const grantResponseJSON = parseJSONSafe(grantResponseRaw);

        if (grantResponseJSON.type === 'error') {
          req.log.debug('received malformed json body from token endpoint');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const grantBodyResult = GrantResponseModel.safeParse(grantResponseJSON.data);

        if (!grantBodyResult.success) {
          req.log.debug('received invalid json body from token endpoint');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const accessToken = grantBodyResult.data.access_token;

        const response = await oauthFetch(`${env.auth.okta.endpoint}/api/v1/users/me`, {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.status !== 200) {
          throw new Error(`Unexpected status code from Okta API: ${response.status}`);
        }

        const OktaProfileModel = z.object({
          id: z.string(),
          profile: z.object({
            email: z.string(),
          }),
        });

        const json = await response.json();
        const profile = OktaProfileModel.parse(json);

        let user = await supertokensStore.findThirdPartyUser({
          thirdPartyId: 'okta',
          thirdPartyUserId: profile.id,
        });

        const emailResult = await isNonOIDCSignUpAllowedForEmailAddress(
          profile.profile.email,
          user,
        );

        if (emailResult.type === 'error') {
          return rep.send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please sign in through your organizations identity provider.',
          });
        }

        if (!user) {
          user = await supertokensStore.createThirdPartyUser({
            email: profile.profile.email,
            thirdPartyId: 'okta',
            thirdPartyUserId: profile.id,
          });
        }

        const ensureUserExists = await storage.ensureUserExists({
          superTokensUserId: user.userId,
          email: user.email,
          firstName: null,
          lastName: null,
          oidcIntegration: null,
        });

        if (!ensureUserExists.ok) {
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in not allowed.',
          });
        }

        supertokensUser = user;
        hiveUser = ensureUserExists.user;
      } else if (parsedBody.data.thirdPartyId === 'oidc') {
        req.log.debug('perform oidc signinup flow');
        // for backwards-compatibility purposes we support the case where the frontend modifies the state to append the oidc id
        const [state] = (parsedBody.data.redirectURIInfo.redirectURIQueryParams.state ?? '').split(
          '--',
        );

        const cacheRecord = await oauthCache.get(state);

        if (cacheRecord?.method !== 'oidc') {
          req.log.debug('failed looking up pending oauth cache record.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please try again.',
          });
        }

        oidcIntegration = await storage.getOIDCIntegrationById({
          oidcIntegrationId: cacheRecord.oidIntegrationId,
        });

        if (!oidcIntegration) {
          req.log.debug('The oidc integration does not exist.');
          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Please try again.',
          });
        }

        const current_url = new URL(env.hiveServices.webApp.url);
        current_url.pathname = '/auth/callback/oidc';

        req.log.debug(
          'attempt exchanging auth code for auth token (endpoint=%s)',
          oidcIntegration.tokenEndpoint,
        );

        broadcastLog(
          oidcIntegration.id,
          `attempt exchanging auth code for auth token on endpoint '${oidcIntegration.tokenEndpoint}'.`,
        );

        const GrantResponseModel = z.object({
          access_token: z.string(),
        });

        const useFederationForExchange =
          workloadIdentityFederation !== null &&
          (env.oidcWorkloadFederation?.organizationIds.includes(
            oidcIntegration.linkedOrganizationId,
          ) ??
            false);

        const grantParams: Record<string, string> = {
          grant_type: 'authorization_code',
          code_verifier: cacheRecord.pkceVerifier,
          code: parsedBody.data.redirectURIInfo.redirectURIQueryParams.code ?? '',
          redirect_uri: current_url.toString(),
          client_id: oidcIntegration.clientId,
        };

        if (useFederationForExchange) {
          // Workload Identity Federation: use client_assertion with the cached federated token
          const federatedToken = workloadIdentityFederation?.getToken() ?? null;
          if (!federatedToken) {
            req.log.error(
              'Workload identity federation is not configured or the token is not yet available',
            );
            return rep.status(200).send({
              status: 'SIGN_IN_UP_NOT_ALLOWED',
              reason: 'Sign in failed. Please contact your organization administrator.',
            });
          }

          grantParams['client_assertion_type'] =
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
          grantParams['client_assertion'] = federatedToken;
        } else {
          grantParams['client_secret'] = crypto.decrypt(oidcIntegration.encryptedClientSecret);
        }

        const grantResponse = await oauthFetch(oidcIntegration.tokenEndpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams(grantParams),
        });

        if (grantResponse.status != 200) {
          req.log.debug('received non 200 status from token endpoint %d', grantResponse.status);
          broadcastLog(
            oidcIntegration.id,
            `an unexpected error occurred while calling your token endoint '${oidcIntegration.tokenEndpoint}'. HTTP Status: ${grantResponse.status} Body: ${await grantResponse.text()}.`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const grantResponseRaw = await grantResponse.text();
        const grantResponseJSON = parseJSONSafe(grantResponseRaw);

        if (grantResponseJSON.type === 'error') {
          req.log.debug('received malformed json body from token endpoint');

          broadcastLog(
            oidcIntegration.id,
            `unexpected body received from the token endpoint '${oidcIntegration.tokenEndpoint}'. Failed parsing JSON. HTTP Status: ${grantResponse.status}.'`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const grantBodyResult = GrantResponseModel.safeParse(grantResponseJSON.data);

        if (!grantBodyResult.success) {
          req.log.debug('received invalid json body from token endpoint');
          broadcastLog(
            oidcIntegration.id,
            `the response from your token endpoint '${oidcIntegration.tokenEndpoint}' did not contain a 'access_token' property.`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const codeGrantAccessToken = grantBodyResult.data.access_token;
        req.log.debug('successfully exchanged code for access token ');
        req.log.debug('attempt fetching user info');

        const userInfoResponse = await oauthFetch(oidcIntegration.userinfoEndpoint, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${codeGrantAccessToken}`,
          },
        });
        const userInfoBodyRaw = await userInfoResponse.text();

        if (userInfoResponse.status != 200) {
          req.log.debug(
            'received invalid status from user info endpoint %d',
            userInfoResponse.status,
          );
          broadcastLog(
            oidcIntegration.id,
            `an unexpected error occurred while calling the user info endoint '${oidcIntegration.userinfoEndpoint}'. HTTP Status: ${userInfoResponse.status} HTTP Body: ${userInfoBodyRaw}.`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const userInfoBodyJSON = parseJSONSafe(userInfoBodyRaw);

        if (userInfoBodyJSON.type === 'error') {
          req.log.debug('received malformed JSON body from user info endpoint');
          broadcastLog(
            oidcIntegration.id,
            `unexpected body received from the user info endpoint '${oidcIntegration.userinfoEndpoint}'. Failed parsing JSON. HTTP Status: ${grantResponse.status}. HTTP Body: '${userInfoBodyRaw}'`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const userInfoBody = z.record(z.unknown()).safeParse(userInfoBodyJSON.data);

        if (!userInfoBody.success) {
          req.log.debug('received invalid JSON body from user info endpoint');
          broadcastLog(
            oidcIntegration.id,
            `unexpected body received from the user info endpoint '${oidcIntegration.userinfoEndpoint}'.` +
              ` Expected '${oidcIntegration.userIdClaim}' and 'email' grant.` +
              ` HTTP Status: ${grantResponse.status}. HTTP Body: '${userInfoBodyRaw}'`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const email = z
          .string()
          // make sure the email is transformed to lower-case
          // sometimes the OIDC provider love giving us custom formatted ones
          .transform(email => email.toLowerCase())
          .safeParse(userInfoBody.data.email);

        if (!email.data) {
          req.log.debug('user info endpoint response did not contain the email grant');
          broadcastLog(
            oidcIntegration.id,
            `missing email grant received from user info endpoint '${oidcIntegration.userinfoEndpoint}. HTTP Status: ${grantResponse.status}. HTTP Body: '${userInfoBodyRaw}'`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        // Check whether the email is allowed to sign-up via this idetity provider
        const [, emailDomain] = email.data.split('@');
        const verifiedDomain = await oidcIntegrations.findVerifiedDomainByName(emailDomain);
        if (verifiedDomain && verifiedDomain.oidcIntegrationId !== oidcIntegration.id) {
          const oidcIntegration = await storage.getOIDCIntegrationById({
            oidcIntegrationId: verifiedDomain.oidcIntegrationId,
          });

          if (oidcIntegration?.oidcForVerifiedDomainsRequired) {
            req.log.debug(
              'the resolved domain of this user is verified with another organization that enforces login through its identity provider. (domain=%s, oidcIntegrationId=%s)',
              emailDomain,
              oidcIntegration.id,
            );
            return rep.status(200).send({
              status: 'SIGN_IN_UP_NOT_ALLOWED',
              reason: 'Sign in failed. Please contact your organization administrator.',
            });
          }
        }

        req.log.debug('lookup existing user for sub and oidc integration');

        const rawExternalIdClaim = (userInfoBody.data as Record<string, unknown>)[
          oidcIntegration.userIdClaim
        ];

        if (rawExternalIdClaim == null) {
          req.log.debug("user id claim '%s' is missing in user info.", oidcIntegration.userIdClaim);
          broadcastLog(
            oidcIntegration.id,
            `unexpected body received from the user info endpoint '${oidcIntegration.userinfoEndpoint}'.` +
              ` Expected '${oidcIntegration.userIdClaim}'claim.` +
              ` HTTP Status: ${grantResponse.status}. HTTP Body: '${userInfoBodyRaw}'`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        const externalUserId = z.string().safeParse(rawExternalIdClaim).data ?? null;

        if (!externalUserId) {
          req.log.debug(
            "user id claim is not a string '%s' is missing in user info.",
            oidcIntegration.userIdClaim,
          );
          broadcastLog(
            oidcIntegration.id,
            `unexpected body received from the user info endpoint '${oidcIntegration.userinfoEndpoint}'.` +
              ` Expected '${oidcIntegration.userIdClaim}' claim to be a string.` +
              ` HTTP Status: ${grantResponse.status}. HTTP Body: '${userInfoBodyRaw}'`,
          );

          return rep.status(200).send({
            status: 'SIGN_IN_UP_NOT_ALLOWED',
            reason: 'Sign in failed. Please contact your organization administrator.',
          });
        }

        let supertokenUser = await supertokensStore.findOIDCUserByExternalIdAndOIDCIntegrationId({
          oidcIntegrationId: oidcIntegration.id,
          externalId: externalUserId,
        });
        const organization = await storage.getOrganization({
          organizationId: oidcIntegration.linkedOrganizationId,
        });

        if (!supertokenUser) {
          req.log.debug('no existing user found.');

          if (
            (organization.featureFlags.scim || isSCIMEnabled) &&
            oidcIntegration.userProvisioningRequired
          ) {
            req.log.debug('oidc integration settings requires user being provisioned.');
            return rep.status(200).send({
              status: 'SIGN_IN_UP_NOT_ALLOWED',
              reason: 'Sign in failed. Please contact your organization administrator.',
            });
          }

          req.log.debug('create new supertokens user.');
          supertokenUser = await supertokensStore.createOIDCUser({
            email: email.data,
            oidcIntegrationId: oidcIntegration.id,
            externalId: externalUserId,
          });
        }

        const maybeHiveUser = await storage.getUserBySuperTokenId({
          superTokensUserId: supertokenUser.userId,
        });

        if (organization.featureFlags.scim || isSCIMEnabled) {
          if (maybeHiveUser?.provisioningStatus === 'active' && maybeHiveUser.deactivatedAt) {
            req.log.debug('user is deactivated.');
            return rep.status(200).send({
              status: 'SIGN_IN_UP_NOT_ALLOWED',
              reason: 'Sign in failed. Please contact your organization administrator.',
            });
          }

          if (
            oidcIntegration.userProvisioningRequired &&
            (!maybeHiveUser ||
              (maybeHiveUser.provisionedByOrganizationId !== organization.id &&
                // the owner always bypasses access restrictions
                organization.ownerId !== maybeHiveUser.id))
          ) {
            req.log.debug('oidc integration settings requires user being provisioned.');
            return rep.status(200).send({
              status: 'SIGN_IN_UP_NOT_ALLOWED',
              reason: 'Sign in failed. Please contact your organization administrator.',
            });
          }
        }

        // only perform these updates if the user is not provisioned
        // if the user is provisioned the SCIM provider is the source of truth for all attributes
        if (
          (!organization.featureFlags.scim && !isSCIMEnabled) ||
          !maybeHiveUser?.provisionedByOrganizationId
        ) {
          if (supertokenUser.email !== email.data) {
            req.log.debug('providers email has changed. Update record.');
            supertokenUser = await supertokensStore.updateOIDCUserEmail({
              userId: supertokenUser.userId,
              newEmail: email.data,
            });

            if (!supertokenUser) {
              return rep.status(200).send({
                status: 'SIGN_IN_UP_NOT_ALLOWED',
                reason: 'Sign in failed. Please contact your organization administrator.',
              });
            }
          }

          req.log.debug('supertokens user provisioned. ensure hive user exists');
          const ensureUserExists = await storage.ensureUserExists({
            superTokensUserId: supertokenUser.userId,
            // make sure we are not updating the email when the user was provisioned
            email: maybeHiveUser?.provisionedByOrganizationId ? maybeHiveUser.email : email.data,
            firstName: null,
            lastName: null,
            // make sure that if the user was provisioned we do not apply the constraint for "require oidc integration"
            oidcIntegration: maybeHiveUser?.provisionedByOrganizationId
              ? null
              : {
                  id: oidcIntegration.id,
                },
          });

          if (!ensureUserExists.ok) {
            req.log.debug('creating hive user is not allowed. Reason: %s', ensureUserExists.reason);
            return rep.status(200).send({
              status: 'SIGN_IN_UP_NOT_ALLOWED',
              reason: 'Sign in not allowed.',
            });
          }
          hiveUser = ensureUserExists.user;
          supertokensUser = supertokenUser;
        } else {
          hiveUser = maybeHiveUser;
          supertokensUser = supertokenUser;
        }
      } else {
        return rep.status(200).send({
          status: 'SIGN_IN_UP_NOT_ALLOWED',
          reason: 'Unsupported sing in method.',
        });
      }

      req.log.debug('create new session for user');

      const { session, refreshToken, accessToken } = await createNewSession(
        supertokensStore,
        {
          hiveUser: hiveUser,
          oidcIntegrationId: oidcIntegration?.id ?? null,
          superTokensUserId: supertokensUser.userId,
        },
        {
          refreshTokenKey: secrets.refreshTokenKey,
          accessTokenKey,
        },
      );
      const frontToken = createFrontToken({
        superTokensUserId: supertokensUser.userId,
        accessToken,
      });

      return rep
        .setCookie('sRefreshToken', refreshToken, {
          httpOnly: true,
          secure: true,
          path: '/auth-api/session/refresh',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .setCookie('sAccessToken', accessToken.token, {
          httpOnly: true,
          secure: true,
          path: '/',
          sameSite: 'lax',
          expires: new Date(session.expiresAt),
        })
        .header('front-token', frontToken)
        .header('access-control-expose-headers', 'front-token')
        .send({
          status: 'OK',
          user: {
            id: supertokensUser.userId,
            isPrimaryUser: false,
            tenantIds: ['public'],
            timeJoined: supertokensUser.timeJoined,
            emails: [supertokensUser.email],
            phoneNumbers: [],
            thirdParty: [
              {
                id: supertokensUser.thirdPartyId,
                userId: supertokensUser.thirdPartyUserId,
              },
            ],
            loginMethods: [
              {
                tenantIds: ['public'],
                recipeUserId: supertokensUser.userId,
                verified: false,
                timeJoined: supertokensUser.timeJoined,
                recipeId: 'thirdparty',
                email: supertokensUser.email,
              },
            ],
          },
        });
    },
  });
}

const GenericFormFieldBody = z.object({
  formFields: z.array(
    z.object({
      id: z.string(),
      value: z.string(),
    }),
  ),
});

const SignUpBodyModel = GenericFormFieldBody.extend({});

const SignInBodyModel = GenericFormFieldBody.extend({});

const UserPasswordResetBodyModel = GenericFormFieldBody.extend({
  method: z.literal('token'),
  token: z.string(),
});

const UserPasswordResetTokenBodyModel = GenericFormFieldBody.extend({});

const AuthorisationurlQueryParamsModel = z.object({
  thirdPartyId: z.string(),
  redirectURIOnProviderDashboard: z.string(),
  oidc_id: z.string().optional(),
});

const ThirdPartySigninupModel = z.object({
  thirdPartyId: z.string(),
  redirectURIInfo: z.object({
    // pkceCodeVerifier: z.string(),
    redirectURIOnProviderDashboard: z.string(),
    redirectURIQueryParams: z.object({
      code: z.string().optional(),
      iss: z.string().optional(),
      redirectToPath: z.string().optional(),
      scope: z.string().optional(),
      session_state: z.string().optional(),
      state: z.string().optional(),
    }),
  }),
});

function parseJSONSafe(input: string):
  | {
      type: 'error';
      error: unknown;
    }
  | {
      type: 'success';
      data: unknown;
    } {
  try {
    return {
      type: 'success',
      data: JSON.parse(input),
    };
  } catch (error) {
    return {
      type: 'error',
      error,
    };
  }
}
