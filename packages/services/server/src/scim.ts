import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuditLogRecorder, ClickHouse, Logger, Storage, type AuditLogSchemaEvent } from '@hive/api';
import { AuthN, Session, UnauthenticatedSession } from '@hive/api/modules/auth/lib/authz';
import { SuperTokensStore } from '@hive/api/modules/auth/providers/supertokens-store';
import { OIDCIntegrationStore } from '@hive/api/modules/oidc-integrations/providers/oidc-integration.store';
import {
  GroupMemberStore,
  type GroupMember,
} from '@hive/api/modules/organization/providers/group-member-store';
import { GroupStore, type Group } from '@hive/api/modules/organization/providers/group-store';
import {
  ProvisionedUsersStore,
  type ProvisionedUser,
} from '@hive/api/modules/organization/providers/provisioned-users-store';
import { RedisRateLimiter } from '@hive/api/modules/shared/providers/redis-rate-limiter';
import { CommonQueryMethods, PostgresDatabasePool } from '@hive/postgres';
import { invariant, metrics } from '@hive/service-common';
import * as Sentry from '@sentry/node';

const scimRequestLabelNames = ['route', 'status_code'] as const;

export const scimRequestCount = new metrics.Counter({
  name: 'api_scim_request_count',
  help: 'Number of completed SCIM requests',
  labelNames: scimRequestLabelNames,
});

export const scimRequestDuration = new metrics.Histogram({
  name: 'api_scim_request_duration_seconds',
  help: 'Duration of completed SCIM requests in seconds',
  labelNames: scimRequestLabelNames,
});

export function getSCIMRequestMetricLabels(
  method: string,
  route: string | undefined,
  statusCode: number,
) {
  const normalizedRoute = `${method} ${route}`;

  return {
    route: route ? normalizedRoute : 'unknown',
    status_code: statusCode,
  };
}

const EmailSchemaModel = z.object({
  value: z.string().email(),
  type: z.string().optional(),
  primary: z.boolean().optional(),
});

const PostUsersBodyModel = z.object({
  userName: z.string().min(1),
  active: z.boolean().optional(),
  /** Entry ID omits this sometimes. In that case we infer the email from the user name. */
  emails: z.array(EmailSchemaModel).optional(),
  externalId: z.string(),
});

const PutUsersBodyModel = z.object({
  active: z.boolean().optional(),
  userName: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  emails: z
    .array(
      z.object({
        value: z.string().toLowerCase().email(),
        primary: z.boolean().optional(),
      }),
    )
    .optional(),
});

/**
 * - Entra sends capitalized...
 * - Okta sends lowercase...
 **/
const CaseInsensitiveRemoveOperationModel = z.string().toLowerCase().pipe(z.literal('remove'));
const CaseInsensitiveAddOperationModel = z.string().toLowerCase().pipe(z.literal('add'));
const CaseInsensitiveReplaceModel = z.string().toLowerCase().pipe(z.literal('replace'));

const PatchOperationModel = z.object({
  op: CaseInsensitiveReplaceModel,
  path: z.string().optional(),
  value: z.unknown().optional(),
});

const PatchUserRequestBodyModel = z.object({
  Operations: z.array(PatchOperationModel).min(1),
});

const QuerySchemaModel = z.object({
  filter: z.string().optional(),
  startIndex: z.coerce
    .number()
    .int()
    .min(1)
    .max(
      /** if someone has more users we can adjust. */
      10_000,
    )
    .optional()
    .default(1),
  count: z.coerce
    .number()
    .int()
    .min(0)
    .max(
      /** Most providers use 100, we are generous here. */
      1000,
    )
    .optional()
    .default(100),
});

const GetGroupQueryModel = z.object({
  /** We only support members as it is required by entra */
  excludedAttributes: z.literal('members').optional(),
});

const GetGroupsQueryModel = QuerySchemaModel.merge(GetGroupQueryModel);

const SharedUserRouteParams = z.object({
  userId: z.string().uuid(),
});

const SharedGroupRouteParams = z.object({
  groupId: z.string(),
});

const GroupMemberSchema = z.object({
  value: z.string().uuid(),
});

const PostGroupsBodyModel = z.object({
  displayName: z.string(),
  externalId: z.string().optional(),
  members: z.array(GroupMemberSchema).optional(),
});

const AddOperationSchema = z.object({
  op: CaseInsensitiveAddOperationModel,
  path: z.literal('members'),
  value: z.array(GroupMemberSchema),
});

const RemoveOperationSchema = z.union([
  /** This is what Okta sends */
  z
    .object({
      op: CaseInsensitiveRemoveOperationModel,
      // e.g. members[value eq "user-123"]
      path: z
        .string()
        .regex(/^members\[value eq "([^"]+)"\]$/, 'Unsupported SCIM member removal path')
        .transform(path => {
          const [, userId] = path.match(/^members\[value eq "([^"]+)"\]$/)!;
          return userId;
        })
        .pipe(z.string().uuid()),
    })
    .transform(value => ({
      op: value.op,
      userIds: [value.path],
    })),
  /** This is what Entra ID sends */
  z
    .object({
      op: CaseInsensitiveRemoveOperationModel,
      path: z.literal('members'),
      value: z.array(z.object({ value: z.string() })),
    })
    .transform(value => ({ op: value.op, userIds: value.value.map(v => v.value) })),
]);

const ReplaceOperationSchema = z.union([
  z.object({
    op: z.literal('replace'),
    path: z.literal('displayName'),
    value: z.string(),
  }),
  z.object({
    op: z.literal('replace'),
    path: z.literal('members'),
    value: z.array(GroupMemberSchema),
  }),
  z.object({
    op: z.literal('replace'),
    path: z.literal('externalId'),
    value: z.string(),
  }),
  z.object({
    op: CaseInsensitiveReplaceModel,
    path: z.undefined().optional(),
    value: z.object({
      displayName: z.string().optional(),
      externalId: z.string().optional(),
    }),
  }),
]);

const GroupPatchOperationSchema = z.union([
  AddOperationSchema,
  RemoveOperationSchema,
  ReplaceOperationSchema,
]);

const PatchGroupsRequestBodySchema = z.object({
  Operations: z.array(GroupPatchOperationSchema).min(1).max(100),
});

const GroupPutBodySchema = z.object({
  members: z.array(GroupMemberSchema).optional(),
  displayName: z.string().optional(),
  externalId: z.string().optional(),
});

export const createSCIMPlugin =
  (
    authn: AuthN,
    pool: PostgresDatabasePool,
    storage: Storage,
    oidcIntegrations: OIDCIntegrationStore,
    rateLimiter: RedisRateLimiter,
    clickHouse: ClickHouse,
    baseUri: string,
    isSCIMEnabled: boolean,
  ): FastifyPluginAsync =>
  async server => {
    const requestStartTimeMap = new WeakMap<FastifyRequest, bigint>();
    server.addHook('onRequest', (request, _reply, done) => {
      requestStartTimeMap.set(request, process.hrtime.bigint());
      done();
    });

    server.addHook('onResponse', (request, reply, done) => {
      const labels = getSCIMRequestMetricLabels(
        request.method,
        request.routeOptions.url,
        reply.statusCode,
      );
      const duration = requestStartTimeMap.get(request);
      invariant(duration, 'Duration must have been set.');
      const durationSeconds = Number(process.hrtime.bigint() - duration) / 1e9;

      scimRequestCount.inc(labels);
      scimRequestDuration.observe(labels, durationSeconds);
      done();
    });

    async function authenticateAuthorizeAndResolveOrganizationFromRequest(
      req: FastifyRequest,
      reply: FastifyReply,
    ) {
      const session = await authn.authenticate({ req, reply });

      if (session instanceof UnauthenticatedSession) {
        req.log.debug('unauthenticated session');
        return {
          type: 'error' as const,
          error: createSCIMError({
            status: 401,
            detail: 'Missing access token.',
          }),
        };
      }

      if (await rateLimiter.isFastifyRouteRateLimited(req, 5 * 60, 1_000)) {
        return {
          type: 'error' as const,
          error: createSCIMError({
            status: 429,
            detail: 'Rate Limited.',
          }),
        };
      }

      const actor = await session.getActor();
      if (actor.type !== 'organizationAccessToken') {
        req.log.debug('invalid authentication type for scim endpoint. (type=%s)', actor.type);
        return {
          type: 'error' as const,
          error: createSCIMError({
            status: 401,
            detail: 'Invalid permissions for performing scim operations.',
          }),
        };
      }

      const canPerformAction = await session.canPerformAction({
        action: 'scim:provision',
        organizationId: actor.organizationAccessToken.organizationId,
        params: {
          organizationId: actor.organizationAccessToken.organizationId,
        },
      });

      if (!canPerformAction) {
        req.log.debug('invalid permissions for calling scim endpoint.');
        return {
          type: 'error' as const,
          error: createSCIMError({
            status: 401,
            detail: 'Invalid permissions for performing scim operations.',
          }),
        };
      }

      const [organization, oidcIntegration] = await Promise.all([
        storage.getOrganization({ organizationId: actor.organizationAccessToken.organizationId }),
        storage.getOIDCIntegrationForOrganization({
          organizationId: actor.organizationAccessToken.organizationId,
        }),
      ]);

      if ((!organization.featureFlags.scim && !isSCIMEnabled) || !oidcIntegration) {
        return {
          type: 'error' as const,
          error: createSCIMError({
            status: 401,
            detail: 'SCIM is not enabled for this organization.',
          }),
        };
      }

      req.log.debug(
        'sufficient permissions for calling scim endpoint. ' +
          req.routeOptions.method +
          ' ' +
          req.routeOptions.url,
      );

      const logger = req.log.child({
        organizationId: actor.organizationAccessToken.organizationId,
        oidcIntegrationId: oidcIntegration.id,
      });

      return {
        type: 'success' as const,
        session,
        organizationId: actor.organizationAccessToken.organizationId,
        oidcIntegration,
        logger,
      };
    }

    async function recordAuditLog(
      auth: { logger: Logger; organizationId: string; session: Session },
      event: AuditLogSchemaEvent,
    ) {
      await new AuditLogRecorder(auth.logger, clickHouse, auth.session).record({
        ...event,
        organizationId: auth.organizationId,
      });
    }

    async function handleEmailValidation(oidcIntegrationId: string, email: string) {
      const [, emailDomainName] = email.split('@');

      const verifiedDomain =
        await oidcIntegrations.findVerifiedDomainByOIDCIntegrationIdAndDomainName(
          oidcIntegrationId,
          emailDomainName,
          pool,
        );

      if (!verifiedDomain) {
        return {
          type: 'error' as const,
          error: createSCIMError({
            status: 400,
            detail: 'Primary email address domain ownership is not verified for this organization.',
          }),
        };
      }

      return {
        type: 'success' as const,
        email,
      };
    }

    async function handleUserPropertyUpdates(
      logger: Logger,
      usersStore: ProvisionedUsersStore,
      supertokensStore: SuperTokensStore,
      organizationId: string,
      oidcIntegrationId: string,
      user: ProvisionedUser,
      updates: z.TypeOf<typeof PutUsersBodyModel>,
    ) {
      let email: string | null = null;

      {
        const newEmail =
          updates.emails?.find(e => e.primary)?.value ?? updates.emails?.at(0)?.value ?? null;

        if (newEmail && newEmail !== user.email) {
          const emailValidationResult = await handleEmailValidation(oidcIntegrationId, newEmail);

          if (emailValidationResult.error) {
            return emailValidationResult;
          }

          email = newEmail;
        }
      }

      return await pool.transaction('update user properties', async trx => {
        let needsSessionInvalidation = false;

        if (updates.active !== undefined) {
          logger.debug('active changed');
          if (user.deactivatedAt === null && !updates.active) {
            user = await usersStore.disableUser(user.id, trx);
          } else if (user.deactivatedAt !== null && updates.active) {
            user = await usersStore.enableUser(user.id, trx);
          }
        }
        if (email) {
          logger.debug('email changed');

          await supertokensStore.updateOIDCUserEmail(
            {
              userId: user.supertokenUserId,
              newEmail: email,
            },
            trx,
          );
          user = await usersStore.updateUserEmail(organizationId, user.id, email, trx);
          needsSessionInvalidation = true;
        }

        if (updates.externalId !== undefined && updates.externalId !== user.externalId) {
          logger.debug('external id changed');
          const newExternalId = updates.externalId;

          await supertokensStore.updateOIDCUserExternalId(
            {
              oidcIntegrationId,
              externalId: newExternalId,
              userId: user.supertokenUserId,
            },
            trx,
          );

          const updateUserExternalIdResult =
            await usersStore.updateExternalIdByOrganizationIdAndUserId(
              organizationId,
              user.id,
              newExternalId,
              trx,
            );

          if (updateUserExternalIdResult.type === 'success') {
            needsSessionInvalidation = true;
          }

          if (updateUserExternalIdResult.type === 'error') {
            if (updateUserExternalIdResult.errorCode === 'notFound') {
              return {
                type: 'error' as const,
                error: createSCIMError({
                  detail: 'User does not exist.',
                  status: 404,
                }),
              };
            }
            if (updateUserExternalIdResult.errorCode === 'conflictOnExternalId') {
              return {
                type: 'error' as const,
                error: createSCIMError({
                  detail: 'Another user with the same external id already exists.',
                  status: 409,
                }),
              };
            }
            updateUserExternalIdResult satisfies never;
          }

          user = updateUserExternalIdResult.user;
        }

        if (updates.userName !== undefined && updates.userName !== user.displayName) {
          const result = await usersStore.updateUserDisplayNameByOrganizationIdAndUserId(
            organizationId,
            user.id,
            updates.userName,
            trx,
          );
          if (result.type === 'error') {
            if (result.errorCode === 'notFound') {
              return {
                type: 'error' as const,
                error: createSCIMError({
                  detail: 'User does not exist.',
                  status: 404,
                }),
              };
            }
            if (result.errorCode === 'displayNameConflict') {
              return {
                type: 'error' as const,
                error: createSCIMError({
                  detail: 'Another user with the same userName already exists.',
                  status: 409,
                }),
              };
            }
            result satisfies never;
          }
          user = result.user;
        }

        if (needsSessionInvalidation) {
          await supertokensStore.invalidateAllSessionsForUser(user.supertokenUserId, trx);
        }

        return {
          type: 'success' as const,
          user,
        };
      });
    }

    async function handleGroupPropertyUpdates(
      groupStore: GroupStore,
      group: Group,
      properties: {
        externalId?: string | null;
        displayName?: string | null;
      },
      trx: CommonQueryMethods,
    ) {
      if (
        group.externalId === properties.externalId &&
        group.displayName === properties.displayName
      ) {
        return {
          type: 'success' as const,
          group,
        };
      }

      if (!properties.externalId && !properties.displayName) {
        return {
          type: 'success' as const,
          group,
        };
      }

      return await trx.transaction('update group properties', async () => {
        const result = await groupStore.updateGroupPropertiesByOrganizationIdAndGroupId(
          group.organizationId,
          group.id,
          {
            displayName: properties.displayName ?? null,
            externalId: properties.externalId ?? null,
          },
          trx,
        );

        if (result.type === 'error') {
          if (result.errorCode === 'notFound') {
            return {
              type: 'error' as const,
              error: createSCIMError({
                detail: 'Group does not exist.',
                status: 404,
              }),
            };
          }
          if (result.errorCode === 'conflictOnDisplayName') {
            return {
              type: 'error' as const,
              error: createSCIMError({
                detail: 'Another group with the same display name already exists.',
                status: 409,
              }),
            };
          }

          if (result.errorCode === 'conflictOnExternalId') {
            return {
              type: 'error' as const,
              error: createSCIMError({
                detail: 'Another group with the same external id already exists.',
                status: 409,
              }),
            };
          }

          result satisfies never;
        }

        return {
          type: 'success' as const,
          group: result.group,
        };
      });
    }

    server.addHook('preParsing', (request, reply, _payload, done) => {
      // Okta Custom App Integrations send 'Content-Type: application/scim+json' with no body which causes fastify to raise an error.
      // In order to still support deletes, we have this code that will unset the content-type in this case :)
      if (
        request.method === 'DELETE' &&
        request.headers['content-type'] === 'application/scim+json' &&
        (request.headers['content-length'] === '0' || !request.headers['content-length'])
      ) {
        request.headers['content-type'] = undefined;
      }
      done();
    });

    server.addContentTypeParser(
      'application/scim+json',
      { parseAs: 'string' },
      server.getDefaultJsonParser('ignore', 'ignore'),
    );

    server.addHook('onSend', (_request, reply, payload, done) => {
      if (reply.statusCode !== 204) {
        void reply.type('application/scim+json');
      }

      done(null, payload);
    });

    server.setErrorHandler(async (error, request, reply) => {
      request.log.error(error);

      Sentry.withScope(scope => {
        scope.setUser({ ip_address: request.ip });
        scope.setTag('feature', 'scim');
        scope.setTag('request_id', request.id);
        scope.setTag('path', request.raw.url);
        scope.setTag('method', request.raw.method);
        Sentry.captureException(error);
      });

      return reply.status(500).send(
        createSCIMError({
          status: 500,
          detail: 'An unexpected error occurred.',
        }),
      );
    });

    /**
     * General notes
     * - the route parameter (:userId; :groupId) is always the id column within our database
     * - external id is the ID on the providers id for a resource
     *   - Both Okta and Entra uses external id for users
     *   - Only Entra uses display name for group matching
     *   - Okta uses the display name for group matching
     *   - we still support external_id for groups though
     * - Okta distinguishes between OIN (Okta Integration network) and custom integrations. Currently Hive Console users can only do custom integrations (we did not apply for the OIN process).
     *   - Okta OIN and custom integrations use different ways for updating groups and members
     *   - Okta OIN uses PATCH wherever possible
     *   - Okta custom integrations uses exclusively uses PUT (which is more expensive on our end for updating user lists...)
     *   - More info here: https://developer.okta.com/docs/api/openapi/okta-scim/guides/scim-20
     */

    server.post('/', (_, reply) => reply.status(200).send('Hive Console SCIM'));

    server.get('/ResourceTypes', async (req, reply) => {
      const auth = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (auth.type === 'error') {
        return reply.status(auth.error.status).send(auth.error);
      }

      const resources: SCIMResourceTypeObject[] = [
        createSCIMResourceTypeObject(baseUri, {
          id: 'User',
          endpoint: '/Users',
          description: 'Hive Console user.',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        }),
        createSCIMResourceTypeObject(baseUri, {
          id: 'Group',
          endpoint: '/Groups',
          description: 'Hive Console group.',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        }),
      ];

      return reply.status(200).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: resources.length,
        startIndex: 1,
        itemsPerPage: resources.length,
        Resources: resources,
      } satisfies SCIMListResponseObject);
    });

    /**
     * This route is used for looking up a specific user
     */
    server.get('/Users/:userId', async (req, reply) => {
      const auth = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (auth.type === 'error') {
        return reply.status(auth.error.status).send(auth.error);
      }

      const params = SharedUserRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'User does not exist.',
            status: 404,
          }),
        );
      }

      const usersStore = new ProvisionedUsersStore(pool);
      const user = await usersStore.findUserProvisionedByOrganizationIdAndId(
        auth.organizationId,
        params.data.userId,
      );

      if (user === null) {
        return reply.status(404).send(
          createSCIMError({
            status: 404,
            detail: 'User does not exist.',
          }),
        );
      }

      const groupMemberStore = new GroupMemberStore(req.log, pool);

      const groupMemberships = await groupMemberStore.getGroupMemberForOrganizationIdAndUserId(
        auth.organizationId,
        user.id,
      );

      return reply.status(200).send(
        createSCIMUserObjectFromUser(
          baseUri,
          user,
          groupMemberships.map(membership => membership.groupId),
        ),
      );
    });

    /**
     * This route is used for provisioning new users on Hive Console
     */
    server.post('/Users', async (req, reply) => {
      const result = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      const bodyParse = PostUsersBodyModel.safeParse(req.body);
      if (bodyParse.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid request body provided.',
          }),
        );
      }

      const usersStore = new ProvisionedUsersStore(pool);
      const supertokensStore = new SuperTokensStore(pool, result.logger);

      const existingUser = await usersStore.findUserProvisionedByOrganizationIdAndExternalId(
        result.organizationId,
        bodyParse.data.externalId,
      );

      if (existingUser) {
        return reply.status(409).send(
          createSCIMError({
            status: 409,
            detail: 'A user with the same external id already exists.',
          }),
        );
      }

      let rawEmail =
        (
          bodyParse.data.emails?.find(email => email.primary === true)?.value ??
          bodyParse.data.emails?.at(0)?.value
        )?.toLowerCase() ?? null;

      if (!rawEmail) {
        if (z.string().email().safeParse(bodyParse.data.userName).success) {
          rawEmail = bodyParse.data.userName.toLowerCase();
        }
      }

      if (!rawEmail) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'User is missing primary email address.',
          }),
        );
      }

      const emailValidationResult = await handleEmailValidation(
        result.oidcIntegration.id,
        rawEmail,
      );

      if (emailValidationResult.error) {
        return reply
          .status(emailValidationResult.error.status)
          .send(createSCIMError(emailValidationResult.error));
      }

      const createUserResult = await pool.transaction('scim user creation', async trx => {
        const supertokensUser = await supertokensStore.createOIDCUserIfNotExists(
          {
            externalId: bodyParse.data.externalId,
            email: emailValidationResult.email,
            oidcIntegrationId: result.oidcIntegration.id,
          },
          trx,
        );

        return await usersStore.createUser(
          {
            email: supertokensUser.email,
            displayName: bodyParse.data.userName,
            fullName: supertokensUser.email,
            superTokensUserId: supertokensUser.userId,
            oidcIntegrationId: result.oidcIntegration.id,
            provisionedByOrganizationId: result.organizationId,
            externalId: bodyParse.data.externalId,
            isDisabled: (bodyParse.data.active ?? true) === false,
          },
          trx,
        );
      });

      if (createUserResult.type === 'error') {
        if (createUserResult.errorCode === 'displayNameConflict') {
          return reply.status(409).send(
            createSCIMError({
              detail: 'Another user with the same userName already exists.',
              status: 409,
            }),
          );
        }
        createUserResult satisfies never;
      }

      await recordAuditLog(result, {
        eventType: 'SCIM_USER_CREATED',
        metadata: {
          userId: createUserResult.user.id,
          externalId: createUserResult.user.externalId,
        },
      });

      return reply
        .status(201)
        .send(createSCIMUserObjectFromUser(baseUri, createUserResult.user, []));
    });

    server.put('/Users/:userId', async (req, reply) => {
      const auth = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (auth.type === 'error') {
        return reply.status(auth.error.status).send(auth.error);
      }

      const params = SharedUserRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'User does not exist.',
            status: 404,
          }),
        );
      }

      const body = PutUsersBodyModel.safeParse(req.body);
      if (body.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid request body provided.',
          }),
        );
      }

      const usersStore = new ProvisionedUsersStore(pool);
      const supertokensStore = new SuperTokensStore(pool, auth.logger);

      let user = await usersStore.findUserProvisionedByOrganizationIdAndId(
        auth.organizationId,
        params.data.userId,
      );

      if (!user) {
        auth.logger.debug({ userId: params.data.userId }, 'user not found');
        return reply.status(404).send(
          createSCIMError({
            detail: 'User does not exist.',
            status: 404,
          }),
        );
      }

      const logger = auth.logger.child({ userId: user.id });
      logger.debug({ userId: user.id }, 'user found');

      const updateUserPropertyResult = await handleUserPropertyUpdates(
        logger,
        usersStore,
        supertokensStore,
        auth.organizationId,
        auth.oidcIntegration.id,
        user,
        body.data,
      );

      if (updateUserPropertyResult.type === 'error') {
        return reply
          .status(updateUserPropertyResult.error.status)
          .send(updateUserPropertyResult.error);
      }

      await recordAuditLog(auth, {
        eventType: 'SCIM_USER_UPDATED',
        metadata: {
          userId: updateUserPropertyResult.user.id,
          updatedFields: Object.keys(body.data).sort().join(', '),
        },
      });

      const groupMemberStore = new GroupMemberStore(req.log, pool);
      const groupMemberships = await groupMemberStore.getGroupMemberForOrganizationIdAndUserId(
        auth.organizationId,
        user.id,
      );

      return reply.status(200).send(
        createSCIMUserObjectFromUser(
          baseUri,
          updateUserPropertyResult.user,
          groupMemberships.map(membership => membership.groupId),
        ),
      );
    });

    server.patch('/Users/:userId', async (req, reply) => {
      const auth = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (auth.type === 'error') {
        return reply.status(auth.error.status).send(auth.error);
      }

      const params = SharedUserRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'User does not exist.',
            status: 404,
          }),
        );
      }

      const body = PatchUserRequestBodyModel.safeParse(req.body);
      if (body.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid request body provided.',
          }),
        );
      }

      const usersStore = new ProvisionedUsersStore(pool);
      const supertokensStore = new SuperTokensStore(pool, auth.logger);
      let user = await usersStore.findUserProvisionedByOrganizationIdAndId(
        auth.organizationId,
        params.data.userId,
      );

      if (!user) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'User does not exist.',
            status: 404,
          }),
        );
      }

      let changes: z.TypeOf<typeof PutUsersBodyModel> = {};
      let hasParseError = false;

      for (const operation of body.data.Operations) {
        if (operation.op !== 'replace') {
          auth.logger.debug(
            'unsupported operation received. we only support replace and patch for now',
            operation.op,
          );
          continue;
        }

        // if no path is provided the value should contain the whole or partial user object,
        // which is identical to the body of the PUT request
        if (operation.path === undefined) {
          const body = PutUsersBodyModel.safeParse(operation.value);
          if (body.error) {
            hasParseError = true;
            break;
          }

          changes = { ...changes, ...body.data };
          continue;
        }

        if (operation.path === 'active') {
          const active = z.boolean().safeParse(operation.value);
          if (!active.success) {
            hasParseError = true;
            break;
          }
          changes.active = active.data;
          continue;
        }

        if (operation.path === 'userName') {
          const userName = z.string().safeParse(operation.value);
          if (!userName.success) {
            hasParseError = true;
            break;
          }
          changes.userName = userName.data;
          continue;
        }

        if (operation.path === 'emails') {
          const email = z.array(EmailSchemaModel).safeParse(operation.value);
          if (!email.success) {
            hasParseError = true;
            break;
          }
          changes.emails = email.data;
          continue;
        }

        if (operation.path === 'externalId') {
          const externalId = z.string().safeParse(operation.value);
          if (!externalId.success) {
            hasParseError = true;
            break;
          }
          changes.externalId = externalId.data;
          continue;
        }

        if (operation.path === 'emails[type eq "work"].value') {
          const email = z.string().email().safeParse(operation.value);
          if (!email.success) {
            hasParseError = true;
            break;
          }
          changes.emails = [
            {
              value: email.data,
              primary: true,
            },
          ];
          continue;
        }

        req.log.debug('unsupported path %s', operation.path);
      }

      if (hasParseError) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'User does not exist.',
            status: 404,
          }),
        );
      }

      const updateUserPropertyResult = await handleUserPropertyUpdates(
        req.log,
        usersStore,
        supertokensStore,
        auth.organizationId,
        auth.oidcIntegration.id,
        user,
        changes,
      );

      if (updateUserPropertyResult.type === 'error') {
        return reply
          .status(updateUserPropertyResult.error.status)
          .send(updateUserPropertyResult.error);
      }

      await recordAuditLog(auth, {
        eventType: 'SCIM_USER_UPDATED',
        metadata: {
          userId: updateUserPropertyResult.user.id,
          updatedFields: Object.keys(changes).sort().join(', '),
        },
      });

      const groupMemberStore = new GroupMemberStore(req.log, pool);
      const groupMemberships = await groupMemberStore.getGroupMemberForOrganizationIdAndUserId(
        auth.organizationId,
        user.id,
      );

      return reply.status(200).send(
        createSCIMUserObjectFromUser(
          baseUri,
          updateUserPropertyResult.user,
          groupMemberships.map(membership => membership.groupId),
        ),
      );
    });

    server.get('/Users', async (req, reply) => {
      const auth = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (auth.type === 'error') {
        return reply.status(auth.error.status).send(auth.error);
      }

      const queryParse = QuerySchemaModel.safeParse(req.query);
      if (queryParse.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid query parameters provided.',
          }),
        );
      }

      const startIndex = queryParse.data.startIndex ?? 1;
      const count = queryParse.data.count ?? 100;

      const usersStore = new ProvisionedUsersStore(pool);
      const groupMemberStore = new GroupMemberStore(req.log, pool);

      if (queryParse.data.filter) {
        const filterParseResult = parseSCIMFilterExpression(queryParse.data.filter, [
          'userName',
          'externalId',
          'id',
        ]);
        if (filterParseResult.type === 'error') {
          return reply.status(400).send(filterParseResult.error);
        }

        const { property, value } = filterParseResult;
        let user: ProvisionedUser | null = null;

        switch (property) {
          case 'userName': {
            user = await usersStore.findUserProvisionedByOrganizationIdAndDisplayName(
              auth.organizationId,
              value,
            );
            break;
          }
          case 'externalId': {
            user = await usersStore.findUserProvisionedByOrganizationIdAndExternalId(
              auth.organizationId,
              value,
            );
            break;
          }
          case 'id': {
            if (!z.string().uuid().safeParse(value).success) {
              break;
            }
            user = await usersStore.findUserProvisionedByOrganizationIdAndId(
              auth.organizationId,
              value,
            );
            break;
          }
        }

        if (!user) {
          return reply.status(200).send({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 0,
            startIndex,
            itemsPerPage: 0,
            Resources: [],
          } satisfies SCIMListResponseObject);
        }

        const groupMemberships = await groupMemberStore.getGroupMemberForOrganizationIdAndUserId(
          auth.organizationId,
          user.id,
        );

        return reply.status(200).send({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: 1,
          startIndex,
          itemsPerPage: 1,
          Resources: [
            createSCIMUserObjectFromUser(
              baseUri,
              user,
              groupMemberships.map(membership => membership.groupId),
            ),
          ],
        } satisfies SCIMListResponseObject);
      }

      const offset = Math.max(0, startIndex - 1);
      const pagedUsers = await usersStore.getOffsetPaginatedUsersForOrganizationId(
        auth.organizationId,
        {
          offset,
          count,
        },
      );

      const users = await Promise.all(
        pagedUsers.map(async user =>
          createSCIMUserObjectFromUser(
            baseUri,
            user,
            await groupMemberStore
              .getGroupMemberForOrganizationIdAndUserId(auth.organizationId, user.id)
              .then(memberships => memberships.map(membership => membership.groupId)),
          ),
        ),
      );

      return reply.status(200).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: await usersStore.getTotalProvisionedUserCountForOrganizationId(
          auth.organizationId,
        ),
        startIndex,
        itemsPerPage: users.length,
        Resources: users,
      } satisfies SCIMListResponseObject);
    });

    server.get('/Groups', async (req, reply) => {
      const result = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      const queryParse = GetGroupsQueryModel.safeParse(req.query);
      if (queryParse.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid query parameters provided.',
          }),
        );
      }

      const groupStore = new GroupStore(result.logger, pool);
      const groupMemberStore = new GroupMemberStore(result.logger, pool);

      const startIndex = queryParse.data.startIndex ?? 1;
      const count = queryParse.data.count ?? 100;

      const groups: Array<SCIMGroupObject> = [];

      if (queryParse.data.filter) {
        const filterParseResult = parseSCIMFilterExpression(queryParse.data.filter, [
          'displayName',
          'id',
          'externalId',
        ]);

        if (filterParseResult.type === 'error') {
          return reply.status(400).send(result.error);
        }

        const { property, value } = filterParseResult;
        let group: Group | null = null;

        switch (property) {
          case 'displayName': {
            group = await groupStore.getGroupByOrganizationIdAndDisplayName(
              result.organizationId,
              value,
            );
            break;
          }
          case 'id': {
            if (!z.string().uuid().safeParse(value).success) {
              break;
            }
            group = await groupStore.getGroupByOrganizationIdAndGroupId(
              result.organizationId,
              value,
            );
            break;
          }
          case 'externalId': {
            group = await groupStore.getGroupByOrganizationIdAndExternalGroupId(
              result.organizationId,
              value,
            );
            break;
          }
        }

        const groupMembers =
          group && queryParse.data.excludedAttributes !== 'members'
            ? await groupMemberStore.getGroupMembersForOrganizationIdAndGroupId(
                result.organizationId,
                group.id,
              )
            : undefined;

        return reply.status(200).send({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: group ? 1 : 0,
          startIndex,
          itemsPerPage: group ? 1 : 0,
          Resources: group ? [createSCIMGroupObjectFromGroup(baseUri, group, groupMembers)] : [],
        } satisfies SCIMListResponseObject);
      }

      const pagedGroups = await groupStore.getOffsetPaginatedGroupsForOrganizationId(
        result.organizationId,
        {
          offset: startIndex - 1,
          count,
        },
      );

      const groupMembersByGroupId =
        queryParse.data.excludedAttributes !== 'members' && pagedGroups.length > 0
          ? await groupMemberStore.getGroupMembersForOrganizationIdAndGroupIds(
              result.organizationId,
              pagedGroups.map(group => group.id),
            )
          : null;

      for (const group of pagedGroups) {
        groups.push(
          createSCIMGroupObjectFromGroup(
            baseUri,
            group,
            groupMembersByGroupId === null
              ? undefined
              : (groupMembersByGroupId.get(group.id) ?? []),
          ),
        );
      }

      return reply.status(200).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: await groupStore.getTotalGroupCountForOrganizationId(result.organizationId),
        startIndex,
        itemsPerPage: groups.length,
        Resources: groups,
      } satisfies SCIMListResponseObject);
    });

    server.get('/Groups/:groupId', async (req, reply) => {
      const result = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      const params = SharedGroupRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Group does not exist.',
            status: 404,
          }),
        );
      }

      const query = GetGroupQueryModel.safeParse(req.query);

      if (query.error) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Failed parsing query string.',
            status: 404,
          }),
        );
      }

      const groupStore = new GroupStore(result.logger, pool);

      const group = await groupStore.getGroupByOrganizationIdAndGroupId(
        result.organizationId,
        params.data.groupId,
      );

      if (!group) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Group does not exist.',
            status: 404,
          }),
        );
      }

      const groupMemberStore = new GroupMemberStore(result.logger, pool);

      const groupMembers =
        query.data.excludedAttributes === 'members'
          ? undefined
          : await groupMemberStore.getGroupMembersForOrganizationIdAndGroupId(
              result.organizationId,
              group.id,
            );

      return reply.status(200).send(createSCIMGroupObjectFromGroup(baseUri, group, groupMembers));
    });

    server.post('/Groups', async (req, reply) => {
      const auth = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (auth.type === 'error') {
        return reply.status(auth.error.status).send(auth.error);
      }

      const body = PostGroupsBodyModel.safeParse(req.body);
      if (body.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid request body provided.',
          }),
        );
      }

      const groupStore = new GroupStore(auth.logger, pool);

      let members: Array<GroupMember> | undefined;
      const result = await pool.transaction('create group', async trx => {
        const createGroupResult = await groupStore.createGroup(
          {
            organizationId: auth.organizationId,
            displayName: body.data.displayName,
            externalId: body.data.externalId ?? null,
          },
          trx,
        );

        if (createGroupResult.type === 'error') {
          if (createGroupResult.errorCode === 'displayNameConflict') {
            return {
              type: 'error' as const,
              error: createSCIMError({
                status: 409,
                detail: 'A SCIM group with the same display name already exists.',
              }),
            };
          }
          if (createGroupResult.errorCode === 'externalIdConflict') {
            return {
              type: 'error' as const,
              error: createSCIMError({
                status: 409,
                detail: 'A SCIM group with the same external id already exists.',
              }),
            };
          }

          createGroupResult satisfies never;
        }

        if (body.data.members) {
          const groupMembersStore = new GroupMemberStore(auth.logger, pool);
          members = await groupMembersStore.addGroupMembersToGroupByOrganizationIdAndGroupId(
            auth.organizationId,
            createGroupResult.group.id,
            body.data.members.map(member => member.value),
            trx,
          );
        }

        return createGroupResult;
      });

      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      await recordAuditLog(auth, {
        eventType: 'SCIM_GROUP_CREATED',
        metadata: {
          groupId: result.group.id,
          externalId: result.group.externalId,
        },
      });

      return reply.status(201).send(createSCIMGroupObjectFromGroup(baseUri, result.group, members));
    });

    server.put('/Groups/:groupId', async (req, reply) => {
      const result = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      const params = SharedGroupRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Group does not exist.',
            status: 404,
          }),
        );
      }

      const body = GroupPutBodySchema.safeParse(req.body);
      if (body.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid request body provided.',
          }),
        );
      }
      const groupStore = new GroupStore(reply.log, pool);
      let group = await groupStore.getGroupByOrganizationIdAndGroupId(
        result.organizationId,
        params.data.groupId,
      );

      if (!group) {
        return reply.status(404).send(
          createSCIMError({
            status: 404,
            detail: 'Group does not exist.',
          }),
        );
      }

      let groupMembers: Array<GroupMember> | undefined;

      const updateGroupPropertiesResult = await pool.transaction('update group', async trx => {
        const updateGroupPropertiesResult = await handleGroupPropertyUpdates(
          groupStore,
          group,
          {
            externalId: body.data.externalId,
            displayName: body.data.displayName,
          },
          trx,
        );

        if (updateGroupPropertiesResult.type === 'error') {
          return updateGroupPropertiesResult;
        }

        const groupMemberStore = new GroupMemberStore(reply.log, pool);
        const memberIds = body.data.members?.map(member => member.value);

        if (Array.isArray(memberIds)) {
          await trx.transaction('scim replace members', async trx => {
            await groupMemberStore.removeAllGroupMembersFromGroupByOrganizationIdAndGroupId(
              result.organizationId,
              group.id,
              trx,
            );
            groupMembers = [];

            if (memberIds.length) {
              groupMembers =
                await groupMemberStore.addGroupMembersToGroupByOrganizationIdAndGroupId(
                  result.organizationId,
                  group.id,
                  memberIds,
                  trx,
                );
            }
          });
        }

        return updateGroupPropertiesResult;
      });

      if (updateGroupPropertiesResult.type === 'error') {
        return reply
          .status(updateGroupPropertiesResult.error.status)
          .send(updateGroupPropertiesResult.error);
      }

      await recordAuditLog(result, {
        eventType: 'SCIM_GROUP_UPDATED',
        metadata: {
          groupId: updateGroupPropertiesResult.group.id,
          updatedFields: Object.keys(body.data).sort().join(', '),
        },
      });

      return reply
        .status(200)
        .send(
          createSCIMGroupObjectFromGroup(baseUri, updateGroupPropertiesResult.group, groupMembers),
        );
    });

    /**
     * This route is used for doing the following things:
     * - group memberships (add/remove users)
     * - properties of group (display name and external id)
     */
    server.patch('/Groups/:groupId', async (req, reply) => {
      const result = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);

      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      const params = SharedGroupRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Group does not exist.',
            status: 404,
          }),
        );
      }

      const body = PatchGroupsRequestBodySchema.safeParse(req.body);
      if (body.error) {
        return reply.status(403).send(
          createSCIMError({
            status: 403,
            detail: 'Invalid request body provided.',
          }),
        );
      }

      const groupStore = new GroupStore(result.logger, pool);

      let group = await groupStore.getGroupByOrganizationIdAndGroupId(
        result.organizationId,
        params.data.groupId,
      );

      if (!group) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Group does not exist.',
            status: 404,
          }),
        );
      }

      /**
       * We gather all the operations for removing and adding users here
       * and then execute them in a batch afterwards.
       *
       * We do not allow mixing a full group user replacement with removing and adding
       * individual users. In reality this does never happen.
       */
      const usersToRemove = new Set<string>();
      const usersToAdd = new Set<string>();
      let fullReplaceUserIds: null | Set<string> = null;

      let newDisplayName: string | null = null;
      let newExternalId: string | null = null;

      let error: SCIMError | null = null;

      for (const operation of body.data.Operations) {
        if (operation.op === 'add') {
          if (fullReplaceUserIds !== null) {
            error = createSCIMError({
              status: 400,
              detail:
                'Mixing adding members and replacing the full member list in the same request is not supported.',
            });
            break;
          }

          for (const record of operation.value) {
            usersToAdd.add(record.value);
            usersToRemove.delete(record.value);
          }
          continue;
        }

        if (operation.op === 'remove') {
          if (fullReplaceUserIds !== null) {
            error = createSCIMError({
              status: 400,
              detail:
                'Mixing adding members and replacing the full member list in the same request is not supported.',
            });
            break;
          }

          for (const id of operation.userIds) {
            usersToAdd.delete(id);
            usersToRemove.add(id);
          }
          continue;
        }

        if (operation.op === 'replace') {
          if (operation.path) {
            if (operation.path === 'displayName') {
              newDisplayName = operation.value;
            }

            if (operation.path === 'externalId') {
              newExternalId = operation.value;
              continue;
            }

            if (operation.path === 'members') {
              if (usersToAdd.size) {
                error = createSCIMError({
                  status: 400,
                  detail:
                    'Mixing adding members and replacing the full member list in the same request is not supported.',
                });
                break;
              }

              if (usersToRemove.size) {
                error = createSCIMError({
                  status: 400,
                  detail:
                    'Mixing removing members and replacing the full member list in the same request is not supported.',
                });
                break;
              }

              if (fullReplaceUserIds !== null) {
                error = createSCIMError({
                  status: 400,
                  detail: 'Replace members multiple times in same request is not supported.',
                });
                break;
              }

              fullReplaceUserIds = new Set(operation.value.map(record => record.value));
            }

            continue;
          } else {
            if (operation.value.displayName) {
              newDisplayName = operation.value.displayName;
            }

            if (operation.value.externalId) {
              newExternalId = operation.value.externalId;
            }
            continue;
          }
        }
        operation satisfies never;
      }

      if (error) {
        return reply.status(error.status).send(error);
      }

      const groupMemberStore = new GroupMemberStore(reply.log, pool);

      const updateGroupResult = await pool.transaction('update group batch', async trx => {
        const updateGroupPropertiesResult = await handleGroupPropertyUpdates(
          groupStore,
          group,
          {
            externalId: newExternalId,
            displayName: newDisplayName,
          },
          trx,
        );

        if (updateGroupPropertiesResult.type === 'error') {
          return updateGroupPropertiesResult;
        }

        if (usersToAdd.size) {
          await groupMemberStore.addGroupMembersToGroupByOrganizationIdAndGroupId(
            result.organizationId,
            group.id,
            Array.from(usersToAdd),
            trx,
          );
        }

        if (usersToRemove.size) {
          await groupMemberStore.removeGroupMembersFromGroupByOrganizationIdAndGroupId(
            result.organizationId,
            group.id,
            Array.from(usersToRemove),
            trx,
          );
        }

        if (fullReplaceUserIds !== null) {
          await trx.transaction('scim replace members', async trx => {
            await groupMemberStore.removeAllGroupMembersFromGroupByOrganizationIdAndGroupId(
              result.organizationId,
              group.id,
              trx,
            );

            if (fullReplaceUserIds.size) {
              await groupMemberStore.addGroupMembersToGroupByOrganizationIdAndGroupId(
                result.organizationId,
                group.id,
                Array.from(fullReplaceUserIds),
                trx,
              );
            }
          });
        }

        return updateGroupPropertiesResult;
      });

      if (updateGroupResult.type === 'error') {
        return reply.status(updateGroupResult.error.status).send(updateGroupResult.error);
      }

      const updatedFields: Array<string> = [];

      if (newDisplayName) {
        updatedFields.push('displayName');
      }
      if (newExternalId) {
        updatedFields.push('externalId');
      }
      if (usersToAdd.size || usersToRemove.size || fullReplaceUserIds !== null) {
        updatedFields.push('members');
      }

      await recordAuditLog(result, {
        eventType: 'SCIM_GROUP_UPDATED',
        metadata: {
          groupId: updateGroupResult.group.id,
          updatedFields: updatedFields.sort().join(', '),
        },
      });

      const groupMembers = await groupMemberStore.getGroupMembersForOrganizationIdAndGroupId(
        result.organizationId,
        group.id,
      );

      return reply
        .status(200)
        .send(createSCIMGroupObjectFromGroup(baseUri, updateGroupResult.group, groupMembers));
    });

    /**
     * This route is used for deleting a group
     */
    server.delete('/Groups/:groupId', async (req, reply) => {
      const result = await authenticateAuthorizeAndResolveOrganizationFromRequest(req, reply);
      if (result.type === 'error') {
        return reply.status(result.error.status).send(result.error);
      }

      const params = SharedGroupRouteParams.safeParse(req.params);

      if (!params.success) {
        return reply.status(404).send(
          createSCIMError({
            detail: 'Group does not exist.',
            status: 404,
          }),
        );
      }

      const groupStore = new GroupStore(req.log, pool);

      const deleteGroupResult = await groupStore.deleteGroup({
        organizationId: result.organizationId,
        groupId: params.data.groupId,
      });

      if (deleteGroupResult.type === 'error') {
        if (deleteGroupResult.errorCode === 'notFound') {
          return reply.status(404).send(
            createSCIMError({
              detail: 'Group does not exist.',
              status: 404,
            }),
          );
        }

        deleteGroupResult satisfies never;
      }

      await recordAuditLog(result, {
        eventType: 'SCIM_GROUP_DELETED',
        metadata: {
          groupId: params.data.groupId,
        },
      });

      return reply.status(204).send();
    });
  };

function createSCIMError(args: { detail: string; status: number }) {
  return {
    ...args,
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
  };
}

type SCIMError = ReturnType<typeof createSCIMError>;

/**
 * Minimal Representation of a SCIM User object to support Okta and Entra.
 */
type SCIMUserObject = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'];
  id: string;
  externalId: string;
  userName: string;
  emails: [
    {
      value: string;
      type: 'work';
      primary: true;
    },
  ];
  active: boolean;
  groups: Array<{
    value: string;
    $ref: string;
  }>;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
  };
};

/**
 * Minimal Representation of a SCIM group object to support Okta and Entra.
 */
type SCIMGroupObject = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'];
  id: string;
  externalId?: string;
  displayName: string;
  members?: {
    value: string;
    $ref: string;
  }[];
  meta: {
    resourceType: 'Group';
    created: string;
    lastModified: string;
    location: string;
  };
};

type SCIMResourceTypeObject = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'];
  id: 'User' | 'Group';
  name: 'User' | 'Group';
  endpoint: '/Users' | '/Groups';
  description: string;
  schema:
    | 'urn:ietf:params:scim:schemas:core:2.0:User'
    | 'urn:ietf:params:scim:schemas:core:2.0:Group';
  meta: {
    resourceType: 'ResourceType';
    location: string;
  };
};

type SCIMListResponseObject = {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: SCIMGroupObject[] | SCIMUserObject[] | SCIMResourceTypeObject[];
};

function createSCIMResourceTypeObject(
  baseUri: string,
  resource: Pick<SCIMResourceTypeObject, 'id' | 'endpoint' | 'description' | 'schema'>,
): SCIMResourceTypeObject {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    ...resource,
    name: resource.id,
    meta: {
      resourceType: 'ResourceType',
      location: `${baseUri}/ResourceTypes/${resource.id}`,
    },
  };
}

function createSCIMUserObjectFromUser(
  baseUri: string,
  user: ProvisionedUser,
  groupIds: Array<string>,
): SCIMUserObject {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: user.id,
    externalId: user.externalId,
    userName: user.displayName,
    emails: [
      {
        primary: true,
        type: 'work',
        value: user.email,
      },
    ],
    active: user.deactivatedAt === null,
    groups: groupIds?.map(groupId => ({
      value: groupId,
      $ref: baseUri + '/Groups/' + groupId,
    })),
    meta: {
      resourceType: 'User',
      created: user.createdAt,
      lastModified: user.lastUpdatedAt ?? user.createdAt,
      location: baseUri + '/Users/' + user.id,
    },
  };
}

function createSCIMGroupObjectFromGroup(
  baseUri: string,
  group: Group,
  /**
   * Members are omitted when the client requests `excludedAttributes=members`.
   */
  members?: Array<GroupMember>,
): SCIMGroupObject {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: group.id,
    externalId: group.externalId ?? undefined,
    displayName: group.displayName,
    members: members?.map(member => ({
      value: member.userId,
      $ref: baseUri + `/Users/${member.userId}`,
    })),
    meta: {
      resourceType: 'Group',
      created: group.createdAt,
      lastModified: group.lastUpdatedAt ?? group.createdAt,
      location: baseUri + '/Groups/' + group.id,
    },
  };
}

type ArrayWithAtLeastOneItem = [string, ...string[]];

function enumerateList(items: ArrayWithAtLeastOneItem): string {
  if (items.length === 1) return `"${items[0]}"`;
  if (items.length === 2) return `"${items[0]}" and "${items[1]}"`;
  return (
    items
      .slice(0, -1)
      .map(item => `"${item}"`)
      .join(', ') + ` and "${items[items.length - 1]}"`
  );
}

function parseSCIMFilterExpression(filter: string, supportedProperties: ArrayWithAtLeastOneItem) {
  /** A filter looks like the following: 'value eq "user-123"'  */
  const [property, eqStr, ...rawValueParts] = filter.trim().split(' ');
  if (!property || !supportedProperties.includes(property) || eqStr !== 'eq') {
    return {
      type: 'error' as const,
      error: createSCIMError({
        status: 400,
        detail:
          'The filter expression is not supported.' +
          ` Only a single "eq" expression for properties ${enumerateList(supportedProperties)} is supported.`,
      }),
    };
  }

  const remainingStr = rawValueParts.join(' ');

  if (remainingStr[0] !== '"' || remainingStr[remainingStr.length - 1] !== '"') {
    return {
      type: 'error' as const,
      error: createSCIMError({
        status: 400,
        detail:
          'The filter expression is not supported.' +
          ` Only a single "eq" expression for properties ${enumerateList(supportedProperties)} is supported.`,
      }),
    };
  }
  const value = remainingStr.substring(1, remainingStr.length - 1);
  return {
    type: 'success' as const,
    property,
    value,
  };
}
