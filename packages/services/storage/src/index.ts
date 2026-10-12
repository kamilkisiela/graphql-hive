import { z } from 'zod';
import type { Member, Organization, OrganizationInvitation, Storage } from '@hive/api';
import {
  CommonQueryMethods,
  createPostgresDatabasePool,
  Interceptor,
  psql,
  SerializableValue,
  TaggedTemplateLiteralInvocation,
  UniqueIntegrityConstraintViolationError,
  type ConnectionStringProvider,
} from '@hive/postgres';
import { createSDLHash } from '../../api/src/shared/entities';
import { batch, batchBy } from '../../api/src/shared/helpers';
import { type organizations } from './db';
import {
  AffectedAppDeployments,
  HiveSchemaChangeModel,
  InsertConditionalBreakingChangeMetadataModel,
  SchemaCheckModel,
  SchemaPolicyWarningModel,
  type SchemaChangeType,
  type SchemaCheckApprovalMetadata,
} from './schema-change-model';

export type { Interceptor };

export type { tokens, schema_policy_resource } from './db/types';

const organizationGetStartedMapping: Record<
  Exclude<keyof Organization['getStarted'], 'id'>,
  keyof organizations
> = {
  creatingProject: 'get_started_creating_project',
  publishingSchema: 'get_started_publishing_schema',
  checkingSchema: 'get_started_checking_schema',
  invitingMembers: 'get_started_inviting_members',
  reportingOperations: 'get_started_reporting_operations',
  enablingUsageBasedBreakingChanges: 'get_started_usage_breaking',
};

export async function createStorage(
  connection: string | ConnectionStringProvider,
  maximumPoolSize: number,
  additionalInterceptors?: Array<Interceptor>,
): Promise<Storage> {
  const pool = await createPostgresDatabasePool({
    connectionParameters: connection,
    maximumPoolSize,
    additionalInterceptors,
  });

  const shared = {
    async getUserBySuperTokenId(
      { superTokensUserId }: { superTokensUserId: string },
      connection: CommonQueryMethods,
    ) {
      const record = await connection.maybeOne(psql`/* getUserBySuperTokenId */
        SELECT
          ${userFields(psql`"users".`)}
        FROM
          "users"
        WHERE
          "users"."supertoken_user_id" = ${superTokensUserId}
        LIMIT 1
      `);

      if (!record) {
        return null;
      }

      return UserModel.parse(record);
    },
    getUserById: batchBy(
      (item: { id: string; connection: CommonQueryMethods }) => item.connection,
      async input => {
        const userIds = input.map(i => i.id);
        const records = await input[0].connection.any(psql`/* getUserById */
          SELECT
            ${userFields(psql`"users".`)}
          FROM
            "users"
          WHERE
            "users"."id" = ANY(${psql.array(userIds, 'uuid')})
        `);

        const mappings = new Map<string, UserType>();
        for (const record of records) {
          const user = UserModel.parse(record);
          mappings.set(user.id, user);
        }

        return userIds.map(async id => mappings.get(id) ?? null);
      },
    ),
    async createUser(
      {
        email,
        fullName,
        displayName,
        superTokensUserId,
        oidcIntegrationId,
      }: {
        email: string;
        fullName: string;
        displayName: string;
        superTokensUserId: string;
        oidcIntegrationId: string | null;
      },
      connection: CommonQueryMethods,
    ) {
      const { id } = await connection
        .maybeOne(
          psql`/* createUser */
            INSERT INTO users
              ("email", "full_name", "display_name", "supertoken_user_id", "oidc_integration_id")
            VALUES
              (${email}, ${fullName}, ${displayName}, ${superTokensUserId}, ${oidcIntegrationId})
            RETURNING id
          `,
        )
        .then(z.object({ id: z.string() }).parse);

      await connection.query(psql`
        INSERT INTO "users_linked_identities" ("user_id", "identity_id")
        VALUES (${id}, ${superTokensUserId})
      `);

      const user = await shared.getUserById({ id, connection });
      if (!user) {
        throw new Error('Something went wrong.');
      }

      return user;
    },
    async getOrganization(userId: string, connection: CommonQueryMethods) {
      return connection
        .maybeOne(
          psql`/* getOrganization */ SELECT ${organizationFields(psql``)} FROM organizations WHERE user_id = ${userId} AND type = ${'PERSONAL'} LIMIT 1`,
        )
        .then(OrganizationModel.nullable().parse);
    },
    async addOrganizationMemberViaOIDCIntegrationId(
      args: {
        oidcIntegrationId: string;
        userId: string;
        invitation: OrganizationInvitation | null;
      },
      connection: CommonQueryMethods,
    ) {
      const linkedOrganizationId = await connection
        .maybeOneFirst(
          psql`/* addOrganizationMemberViaOIDCIntegrationId */
          SELECT
            "linked_organization_id"
          FROM
            "oidc_integrations"
          WHERE
            "id" = ${args.oidcIntegrationId}
        `,
        )
        .then(z.string().nullable().parse);

      if (linkedOrganizationId === null) {
        return;
      }

      // Add user and assign role (either the invited role, custom default role, or Viewer)
      await connection.query(
        psql`/* addOrganizationMemberViaOIDCIntegrationId */
          INSERT INTO organization_member
            (organization_id, user_id, role_id, assigned_resources, created_at)
          VALUES
            (
              ${linkedOrganizationId},
              ${args.userId},
              (
                COALESCE(
                  ${args.invitation?.roleId ?? null},
                  (SELECT default_role_id FROM oidc_integrations
                    WHERE id = ${args.oidcIntegrationId}),
                  (SELECT id FROM organization_member_roles
                    WHERE organization_id = ${linkedOrganizationId} AND name = 'Viewer')
                )
              ),
              ${
                args.invitation?.assignedResources
                  ? psql.jsonb(args.invitation.assignedResources)
                  : psql`(SELECT default_assigned_resources FROM oidc_integrations
                      WHERE id = ${args.oidcIntegrationId})`
              },
              now()
            )
          ${args.invitation ? psql`` : psql`ON CONFLICT DO NOTHING`}
          RETURNING *
        `,
      );
    },
    async getOrganizationMemberRoleByName(
      args: {
        organizationId: string;
        roleName: string;
      },
      connection: CommonQueryMethods,
    ) {
      const roleId = await connection
        .oneFirst(
          psql`/* getOrganizationMemberRoleByName */
          SELECT
            "id"
          FROM
            "organization_member_roles"
          WHERE
            "organization_id" = ${args.organizationId}
            AND "name" = ${args.roleName}
          LIMIT 1
        `,
        )
        .then(z.string().parse);

      return roleId;
    },
    getOIDCIntegrationById(args: { oidcIntegrationId: string }, connection: CommonQueryMethods) {
      return connection
        .maybeOne(
          psql`/* getOIDCIntegrationById */
        SELECT
          ${oidcIntegrationFields()}
        FROM
          "oidc_integrations"
        WHERE
          "id" = ${args.oidcIntegrationId}
        LIMIT 1
      `,
        )
        .then(OIDCIntegrationModel.nullable().parse);
    },
  };

  function buildUserData(input: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    superTokensUserId: string;
    oidcIntegrationId: string | null;
  }) {
    const { firstName, lastName } = input;
    const name =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : input.email.split('@')[0].slice(0, 25).padEnd(2, '1');

    return {
      email: input.email,
      displayName: name,
      fullName: name,
      superTokensUserId: input.superTokensUserId,
      oidcIntegrationId: input.oidcIntegrationId,
    };
  }

  const storage: Storage = {
    destroy() {
      return pool.end();
    },
    async isReady() {
      try {
        await pool.exists(psql`/* Heartbeat */ SELECT 1`);
        return true;
      } catch {
        return false;
      }
    },
    async ensureUserExists({
      superTokensUserId,
      oidcIntegration,
      firstName,
      lastName,
      ...args
    }: {
      superTokensUserId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      oidcIntegration: null | {
        id: string;
      };
    }) {
      const email = args.email.toLowerCase();
      class EnsureUserExistsError extends Error {}

      try {
        return await pool.transaction('ensureUserExists', async t => {
          let action: 'created' | 'no_action' = 'no_action';

          // try searching existing user first
          let internalUser = await t
            .maybeOne(
              psql`
                SELECT
                  ${userFields(psql`"users".`)}
                FROM "users"
                WHERE
                  "users"."supertoken_user_id" = ${superTokensUserId}
                  OR EXISTS (
                    SELECT 1 FROM "users_linked_identities" "uli"
                    WHERE "uli"."user_id" = "users"."id"
                    AND "uli"."identity_id" = ${superTokensUserId}
                  )
              `,
            )
            .then(UserModel.nullable().parse);

          if (internalUser && internalUser.provisioningStatus === 'active') {
            return {
              ok: true,
              user: internalUser,
              action: 'no_action',
            };
          }

          if (!internalUser) {
            // try automatic account linking
            const sameEmailUsers = await t
              .any(
                psql`/* ensureUserExists */
                  SELECT ${userFields(psql`"users".`)}
                  FROM "users"
                  WHERE
                    "users"."email" = lower(${email})
                    AND "users"."provisioned_by_organization_id" IS NULL
                  ORDER BY "users"."created_at";
                `,
              )
              .then(users => users.map(user => UserModel.parse(user)));

            if (sameEmailUsers.length === 1) {
              internalUser = sameEmailUsers[0];
              await t.query(psql`
                INSERT INTO "users_linked_identities" ("user_id", "identity_id")
                VALUES (${internalUser.id}, ${superTokensUserId})
              `);
            }
          }

          let invitation: OrganizationInvitation | null = null;

          if (oidcIntegration?.id) {
            const oidcConfig = await shared.getOIDCIntegrationById(
              {
                oidcIntegrationId: oidcIntegration.id,
              },
              t,
            );

            if (oidcConfig) {
              invitation = await t
                .maybeOne(
                  psql`
                    DELETE FROM "organization_invitations" AS "oi"
                    WHERE
                      "oi"."organization_id" = ${oidcConfig.linkedOrganizationId}
                      AND lower("oi"."email") = lower(${email})
                      AND "oi"."expires_at" > now()
                    RETURNING
                      "oi"."organization_id" "organizationId"
                      , "oi"."code" "code"
                      , "oi"."email" "email"
                      , to_json("oi"."created_at") "createdAt"
                      , to_json("oi"."expires_at") "expiresAt"
                      , "oi"."role_id" "roleId"
                      , "oi"."assigned_resources" "assignedResources"
                  `,
                )
                .then(OrganizationInvitationModel.nullable().parse);
            }

            if (oidcConfig?.requireInvitation && !invitation) {
              const member = internalUser
                ? await t
                    .maybeOne(
                      psql`/* getOrganizationMember */
                    SELECT
                      ${userFields(psql`"u".`)},
                      omr.scopes as scopes,
                      om.organization_id AS "organizationId",
                      om.connected_to_zendesk AS "connectedToZendesk",
                      CASE WHEN o.user_id = om.user_id THEN true ELSE false END AS "isOwner",
                      omr.id as "roleId",
                      omr.name as "roleName",
                      omr.locked as "roleLocked",
                      omr.scopes as "roleScopes",
                      omr.description as "roleDescription"
                    FROM organization_member as om
                    LEFT JOIN organizations as o ON (o.id = om.organization_id)
                    LEFT JOIN users as u ON (u.id = om.user_id)
                    LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
                    WHERE
                      om.organization_id = ${oidcConfig.linkedOrganizationId}
                      AND om.user_id = ${internalUser.id}
                    ORDER BY u.created_at DESC
                  `,
                    )
                    .then(MemberModel.nullable().parse)
                : null;

              if (!member) {
                throw new EnsureUserExistsError('User is not invited to the organization.');
              }
            }
          }

          // either user is brand new or user is not linkable (multiple accounts with the same email exist)
          if (!internalUser) {
            internalUser = await shared.createUser(
              buildUserData({
                email,
                firstName,
                lastName,
                superTokensUserId,
                oidcIntegrationId: oidcIntegration?.id ?? null,
              }),
              t,
            );

            action = 'created';
          }

          if (internalUser.email !== email) {
            await t.query(psql`
              UPDATE "users"
              SET "email" = lower(${email})
              WHERE "id" = ${internalUser.id}
            `);
            internalUser.email = email.toLowerCase();
          }

          if (oidcIntegration !== null) {
            // Add user to OIDC linked integration
            await shared.addOrganizationMemberViaOIDCIntegrationId(
              {
                oidcIntegrationId: oidcIntegration.id,
                userId: internalUser.id,
                invitation,
              },
              t,
            );
          }

          return {
            ok: true,
            user: internalUser,
            action,
          };
        });
      } catch (e) {
        if (e instanceof EnsureUserExistsError) {
          return {
            ok: false,
            reason: e.message,
          };
        }
        throw e;
      }
    },
    async getUserBySuperTokenId({ superTokensUserId }) {
      return shared.getUserBySuperTokenId({ superTokensUserId }, pool);
    },
    async getUserById({ id }) {
      return shared.getUserById({ id, connection: pool });
    },
    async updateUser({ id, displayName, fullName }) {
      await pool.query(psql`/* updateUser */
        UPDATE "users"
        SET
          "display_name" = ${displayName}
          , "full_name" = ${fullName}
        WHERE
          "id" = ${id}
      `);

      const user = await this.getUserById({ id });

      if (!user) {
        throw new Error('Something went wrong.');
      }

      return user;
    },
    createOrganization(input) {
      return pool.transaction('createOrganization', async t => {
        if (input.reservedSlugs.includes(input.slug)) {
          return {
            ok: false,
            message: 'Organization slug is reserved',
          };
        }

        const orgSlugExists = await t.exists(
          psql`/* orgSlugExists */ SELECT 1 FROM organizations WHERE clean_id = ${input.slug} LIMIT 1`,
        );

        if (orgSlugExists) {
          return {
            ok: false,
            message: 'Organization slug is already taken',
          };
        }

        const org = await t
          .maybeOne(
            psql`/* createOrganization */
            INSERT INTO organizations
              ("name", "clean_id", "user_id")
            VALUES
              (${input.slug}, ${input.slug}, ${input.userId})
            RETURNING ${organizationFields(psql``)}
          `,
          )
          .then(OrganizationModel.parse);

        // Create default roles for the organization
        const roles = await t
          .any(
            psql`/* createOrganizationRoles */
            INSERT INTO organization_member_roles
            (
              organization_id,
              name,
              description,
              locked
            )
            VALUES (
              ${org.id},
              'Admin',
              'Full access to all organization resources',
              true
            ), (
              ${org.id},
              'Viewer',
              'Read-only access to all organization resources',
              true
            )
            RETURNING id, name
          `,
          )
          .then(z.array(z.object({ id: z.string(), name: z.string() })).parse);

        const adminRole = roles.find(role => role.name === 'Admin');

        if (!adminRole) {
          throw new Error('Admin role not found');
        }

        // Assign the admin role to the user
        await t.query(
          psql`/* assignAdminRole */
            INSERT INTO organization_member
              ("organization_id", "user_id", "role_id", "created_at")
            VALUES
              (${org.id}, ${input.userId}, ${adminRole.id}, now())
          `,
        );

        return {
          ok: true,
          organization: org,
        };
      });
    },
    async deleteOrganization({ organizationId: organization }) {
      const result = await pool.transaction('DeleteOrganization', async t => {
        const tokens = await t
          .any(
            psql`/* findTokensForDeletion */
            SELECT token FROM tokens WHERE organization_id = ${organization} AND deleted_at IS NULL
          `,
          )
          .then(z.array(z.object({ token: z.string() })).parse);

        return {
          organization: await t
            .maybeOne(
              psql`/* deleteOrganization */
                DELETE FROM organizations
                WHERE id = ${organization}
                RETURNING ${organizationFields(psql``)}
              `,
            )
            .then(OrganizationModel.parse),
          tokens: tokens.map(row => row.token),
        };
      });

      return {
        ...result.organization,
        tokens: result.tokens,
      };
    },
    async getOrganizationId({ organizationSlug }) {
      // Based on clean_id, resolve id
      const result = await pool
        .maybeOne(
          psql`/* getOrganizationId */
            SELECT id FROM organizations WHERE clean_id = ${organizationSlug} LIMIT 1
          `,
        )
        .then(z.object({ id: z.string() }).nullable().parse);

      if (!result) {
        return null;
      }

      return result.id;
    },
    getOrganizationOwnerId: batch(async selectors => {
      const organizations = selectors.map(s => s.organizationId);
      const owners = await pool
        .any(
          psql`/* getOrganizationOwnerId */
        SELECT id, user_id
        FROM organizations
        WHERE id IN (${psql.join(organizations, psql.fragment`, `)})`,
        )
        .then(z.array(OrganizationUserIdAndIdModel).parse);

      return organizations.map(async organization => {
        const owner = owners.find(row => row.id === organization);

        if (owner) {
          return owner.user_id;
        }

        return null;
      });
    }),
    getOrganizationOwner: batch(async selectors => {
      const organizations = selectors.map(s => s.organizationId);
      const owners = await pool.any(
        psql`/* getOrganizationOwner */
        SELECT
          ${userFields(psql`"u".`)},
          omr.scopes as scopes,
          om.organization_id AS "organizationId",
          om.connected_to_zendesk AS "connectedToZendesk",
          true AS "isOwner",
          omr.id as "roleId",
          omr.name as "roleName",
          omr.locked as "roleLocked",
          omr.scopes as "roleScopes",
          omr.description as "roleDescription"
        FROM organizations as o
        LEFT JOIN users as u ON (u.id = o.user_id)
        LEFT JOIN organization_member as om ON (om.user_id = u.id AND om.organization_id = o.id)
        LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
        WHERE o.id = ANY(${psql.array(organizations, 'uuid')})`,
      );

      const parsedOwners = z.array(MemberModel).parse(owners);

      return organizations.map(organization => {
        const owner = parsedOwners.find(row => row.organization === organization);

        if (owner) {
          return Promise.resolve(owner);
        }

        return Promise.reject(new Error(`Owner not found (organization=${organization})`));
      });
    }),
    async countOrganizationMembers({ organizationId: organization }) {
      const { total } = await pool
        .maybeOne(
          psql`/* countOrganizationMembers */ SELECT COUNT(*) as total FROM organization_member WHERE organization_id = ${organization}`,
        )
        .then(z.object({ total: z.number() }).parse);

      return total;
    },
    getOrganizationMember: batch(async selectors => {
      const membersResult = await pool.any(
        psql`/* getOrganizationMember */
          SELECT
            ${userFields(psql`"u".`)},
            omr.scopes as scopes,
            om.organization_id AS "organizationId",
            om.connected_to_zendesk AS "connectedToZendesk",
            CASE WHEN o.user_id = om.user_id THEN true ELSE false END AS "isOwner",
            omr.id as "roleId",
            omr.name as "roleName",
            omr.locked as "roleLocked",
            omr.scopes as "roleScopes",
            omr.description as "roleDescription"
          FROM organization_member as om
          LEFT JOIN organizations as o ON (o.id = om.organization_id)
          LEFT JOIN users as u ON (u.id = om.user_id)
          LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
          WHERE (om.organization_id, om.user_id) IN ((${psql.join(
            selectors.map(s => psql`${s.organizationId}, ${s.userId}`),
            psql.fragment`), (`,
          )}))
          ORDER BY u.created_at DESC
        `,
      );

      const parsedMembers = z.array(MemberModel).parse(membersResult);

      return selectors.map(selector => {
        const member = parsedMembers.find(
          row => row.organization === selector.organizationId && row.id === selector.userId,
        );

        if (member) {
          return Promise.resolve(member);
        }

        return Promise.resolve(null);
      });
    }),

    async getOrganizationInvitations(organizationId, args) {
      let cursor: null | {
        createdAt: string;
        /** email */
        hash: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 50) : 50) : 50;

      if (args.after) {
        cursor = decodeCreatedAtAndHashBasedCursor(args.after);
      }

      const query = psql`
        SELECT
          oi.organization_id AS "organizationId"
          , oi.code
          , oi.email
          , to_json(oi.created_at) as "createdAt"
          , to_json(oi.expires_at) as "expiresAt"
          , oi.role_id as "roleId"
          , oi.assigned_resources as "assignedResources"
        FROM
          organization_invitations as oi
        LEFT JOIN organization_member_roles as omr ON (omr.organization_id = oi.organization_id AND omr.id = oi.role_id)
        WHERE
          oi.organization_id = ${organizationId}
          ${
            cursor
              ? psql`
                  AND (
                    (
                      oi.created_at = ${cursor.createdAt}
                      AND oi.email < ${cursor.hash}
                    )
                    OR oi.created_at < ${cursor.createdAt}
                  )
                `
              : psql``
          }
          AND oi.expires_at > NOW()
        ORDER BY
          oi.created_at DESC
          , oi.email DESC
        LIMIT ${limit + 1}
      `;

      const result = await pool.any(query).then(z.array(OrganizationInvitationModel).parse);

      let edges = result.map(node => {
        return {
          node,
          get cursor() {
            return encodeCreatedAtAndHashBasedCursor({
              createdAt: node.createdAt,
              hash: node.email,
            });
          },
        };
      });

      const hasNextPage = edges.length > limit;
      edges = edges.slice(0, limit);

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: cursor !== null,
          get endCursor() {
            return edges[edges.length - 1]?.cursor ?? '';
          },
          get startCursor() {
            return edges[0]?.cursor ?? '';
          },
        },
      };
    },

    async deleteOrganizationMemberRole({ organizationId, roleId }) {
      await pool.transaction('deleteOrganizationMemberRole', async t => {
        const viewerRoleId = await t
          .oneFirst(
            psql`/* getViewerRoleId */
          SELECT id FROM organization_member_roles
          WHERE organization_id = ${organizationId} AND locked = true AND name = 'Viewer'
          LIMIT 1
        `,
          )
          .then(z.string().parse);

        // move all invitations to the viewer role
        await t.query(psql`/* moveInvitations */
          UPDATE organization_invitations
          SET role_id = ${viewerRoleId}
          WHERE role_id = ${roleId} AND organization_id = ${organizationId}
        `);

        await t.query(psql`/* deleteOrganizationMemberRole */
          DELETE FROM organization_member_roles
          WHERE
            organization_id = ${organizationId}
            AND id = ${roleId}
            AND locked = false
            AND (
              SELECT count(*)
              FROM organization_member
              WHERE role_id = ${roleId} AND organization_id = ${organizationId}
              ) = 0
        `);
      });
    },
    async getOrganizationMemberAccessPairs(pairs) {
      const results = await pool
        .any(
          psql`/* getOrganizationMemberAccessPairs */
          SELECT om.organization_id, om.user_id, omr.scopes as scopes
          FROM organization_member as om
          LEFT JOIN organization_member_roles as omr ON (omr.organization_id = om.organization_id AND omr.id = om.role_id)
          WHERE (om.organization_id, om.user_id) IN ((${psql.join(
            pairs.map(p => psql`${p.organizationId}, ${p.userId}`),
            psql.fragment`), (`,
          )}))
        `,
        )
        .then(z.array(OrganizationMemberAccessModel).parse);

      return pairs.map(({ organizationId: organization, userId: user }) => {
        return (results.find(row => row.organization_id === organization && row.user_id === user)
          ?.scopes || []) as Member['scopes'];
      });
    },
    async updateOrganizationSlug({ slug, organizationId: organization, reservedSlugs }) {
      return pool.transaction('updateOrganizationSlug', async t => {
        if (reservedSlugs.includes(slug)) {
          return {
            ok: false,
            message: 'Provided organization slug is not allowed',
          };
        }

        const orgSlugExists = await t.exists(
          psql`/* orgSlugExists */ SELECT 1 FROM organizations WHERE clean_id = ${slug} AND id != ${organization} LIMIT 1`,
        );

        if (orgSlugExists) {
          return {
            ok: false,
            message: 'Organization slug is already taken',
          };
        }

        return {
          ok: true,
          organization: await t
            .maybeOne(
              psql`/* updateOrganizationSlug */
              UPDATE organizations
              SET clean_id = ${slug}, name = ${slug}
              WHERE id = ${organization}
              RETURNING ${organizationFields(psql``)}
            `,
            )
            .then(OrganizationModel.parse),
        };
      });
    },

    async updateOrganizationPlan({ billingPlan, organizationId: organization }) {
      return pool
        .maybeOne(
          psql`/* updateOrganizationPlan */
          UPDATE organizations
          SET plan_name = ${billingPlan}
          WHERE id = ${organization}
          RETURNING ${organizationFields(psql``)}
        `,
        )
        .then(OrganizationModel.parse);
    },
    async updateOrganizationRateLimits(args, action) {
      return await pool.transaction('updateOrganizationRateLimits', async t => {
        const org = await t
          .maybeOne(
            psql`/* updateOrganizationRateLimits */
            UPDATE organizations
            SET limit_operations_monthly = ${args.monthlyRateLimit.operations}, limit_retention_days = ${args.monthlyRateLimit.retentionInDays}
            WHERE id = ${args.organizationId}
            RETURNING ${organizationFields(psql``)}
          `,
          )
          .then(OrganizationModel.parse);
        await action?.();

        return org;
      });
    },
    async createOrganizationInvitation(args) {
      return pool.transaction('createOrganizationInvitation', async trx => {
        const invitation = await trx
          .maybeOne(
            psql`/* createOrganizationInvitation */
            INSERT INTO "organization_invitations" (
              "organization_id"
              , "email"
              , "role_id"
              , "assigned_resources"
            )
            VALUES (
              ${args.organizationId}
              , lower(${args.email})
              , ${args.roleId}
              , ${args.resourceAssignments === null ? null : psql.jsonb(args.resourceAssignments)}
            )
            RETURNING
              "organization_id" AS "organizationId"
              , "code"
              , "email"
              , to_json("created_at") AS "createdAt"
              , to_json("expires_at") AS "expiresAt"
              , "role_id" AS "roleId"
              , "assigned_resources" AS "assignedResources"
          `,
          )
          .then(OrganizationInvitationModel.parse);

        return invitation;
      });
    },
    async deleteOrganizationInvitationByEmail({ organizationId: organization, email }) {
      return pool.transaction('deleteOrganizationInvitationByEmail', async trx => {
        return trx
          .maybeOne(
            psql`/* deleteOrganizationInvitationByEmail */
                DELETE FROM organization_invitations
                WHERE
                  organization_id = ${organization}
                  AND email = lower(${email})
                RETURNING
                  "organization_id" AS "organizationId"
                  , "code"
                  , "email"
                  , to_json("created_at") AS "createdAt"
                  , to_json("expires_at") AS "expiresAt"
                  , "role_id" AS "roleId"
                  , "assigned_resources" AS "assignedResources"
              `,
          )
          .then(OrganizationInvitationModel.nullable().parse);
      });
    },
    async addOrganizationMemberViaInvitationCode({
      code,
      userId: user,
      organizationId: organization,
    }) {
      await pool.transaction('addOrganizationMemberViaInvitationCode', async trx => {
        const { roleId, assignedResources } = await trx
          .maybeOne(
            psql`/* deleteInviteAndGetRoleId */
            DELETE
            FROM
              "organization_invitations"
            WHERE
              "organization_id" = ${organization}
              AND "code" = ${code}
            RETURNING
              role_id as "roleId"
              , assigned_resources as "assignedResources"
          `,
          )
          .then(
            z.object({
              roleId: z.string(),
              assignedResources: z.record(z.any()).nullable(),
            }).parse,
          );

        await trx.query(
          psql`/* addOrganizationMemberViaInvitationCode */
            INSERT INTO "organization_member" (
              "organization_id"
              , "user_id"
              , "role_id"
              , "assigned_resources"
              , "created_at"
            )
            VALUES (
              ${organization}
              , ${user}
              , ${roleId}
              , ${assignedResources === null ? null : psql.json(assignedResources)}
              , now()
            )
          `,
        );
      });
    },
    async createOrganizationTransferRequest({ organizationId: organization, userId: user }) {
      const code = Math.random().toString(16).substring(2, 12);

      await pool.any(
        psql`/* createOrganizationTransferRequest */
          UPDATE organizations
          SET
            ownership_transfer_user_id = ${user},
            ownership_transfer_code = ${code},
            ownership_transfer_expires_at = NOW() + INTERVAL '1 day'
          WHERE id = ${organization}
        `,
      );

      return {
        code,
      };
    },
    async getOrganizationTransferRequest({ code, userId: user, organizationId: organization }) {
      return pool
        .maybeOne(
          psql`/* getOrganizationTransferRequest */
          SELECT ownership_transfer_code as code FROM organizations
          WHERE
            ownership_transfer_user_id = ${user}
            AND id = ${organization}
            AND ownership_transfer_code = ${code}
            AND ownership_transfer_expires_at > NOW()
        `,
        )
        .then(z.object({ code: z.string() }).nullable().parse);
    },
    async answerOrganizationTransferRequest({
      organizationId: organization,
      userId: user,
      code,
      accept,
    }) {
      await pool.transaction('answerOrganizationTransferRequest', async tsx => {
        const owner = await tsx.maybeOne(
          psql`/* findOrganizationTransferRequest */
          SELECT user_id
          FROM organizations
          WHERE
            id = ${organization}
            AND ownership_transfer_user_id = ${user}
            AND ownership_transfer_code = ${code}
            AND ownership_transfer_expires_at > NOW()
        `,
        );

        if (!owner) {
          throw new Error('No organization transfer request found');
        }

        if (!accept) {
          // NULL out the transfer request
          await tsx.query(psql`/* rejectOrganizationTransferRequest */
            UPDATE organizations
            SET
              ownership_transfer_user_id = NULL,
              ownership_transfer_code = NULL,
              ownership_transfer_expires_at = NULL
            WHERE id = ${organization}
          `);

          // because it's a rejection, we don't need to do anything else other than null out the transfer request
          return;
        }

        const adminRoleId = await shared.getOrganizationMemberRoleByName(
          {
            organizationId: organization,
            roleName: 'Admin',
          },
          tsx,
        );

        // set admin role
        await tsx.query(psql`/* setAdminRole */
          UPDATE organization_member
          SET role_id = ${adminRoleId}
          WHERE organization_id = ${organization} AND user_id = ${user}
        `);

        // NULL out the transfer request
        // assign the new owner
        await tsx.query(psql`/* acceptOrganizationTransferRequest */
          UPDATE organizations
          SET
            ownership_transfer_user_id = NULL,
            ownership_transfer_code = NULL,
            ownership_transfer_expires_at = NULL,
            user_id = ${user}
          WHERE id = ${organization}
        `);
      });
    },
    async deleteOrganizationMember({ userId: user, organizationId: organization }) {
      await pool.query(
        psql`/* deleteOrganizationMember */
          DELETE FROM organization_member
          WHERE organization_id = ${organization} AND user_id = ${user}
        `,
      );
    },
    async getOrganization({ organizationId }) {
      return pool
        .maybeOne(
          psql`/* getOrganization */ SELECT ${organizationFields(psql``)} FROM organizations WHERE id = ${organizationId} LIMIT 1`,
        )
        .then(OrganizationModel.parse);
    },
    async getOrganizations({ userId: user }) {
      return pool
        .any(
          psql`/* getOrganizations */
          SELECT ${organizationFields(psql`o.`)}
          FROM organizations as o
          LEFT JOIN organization_member as om ON (om.organization_id = o.id)
          WHERE om.user_id = ${user}
          ORDER BY o.created_at DESC
        `,
        )
        .then(z.array(OrganizationModel).parse);
    },
    async getOrganizationByInviteCode({ inviteCode, email }) {
      return pool
        .maybeOne(
          psql`/* getOrganizationByInviteCode */
          SELECT ${organizationFields(psql`o.`)} FROM organizations as o
          LEFT JOIN organization_invitations as i ON (i.organization_id = o.id)
          WHERE
            i.code = ${inviteCode}
            AND i.email = lower(${email})
            AND i.expires_at > NOW()
          GROUP BY o.id
          LIMIT 1
        `,
        )
        .then(OrganizationModel.nullable().parse);
    },
    async getOrganizationBySlug({ slug }) {
      return pool
        .maybeOne(
          psql`/* getOrganizationBySlug */ SELECT ${organizationFields(psql``)} FROM organizations WHERE clean_id = ${slug} LIMIT 1`,
        )
        .then(OrganizationModel.nullable().parse);
    },
    async getOrganizationByGitHubInstallationId({ installationId }) {
      return pool
        .maybeOne(
          psql`/* getOrganizationByGitHubInstallationId */
          SELECT ${organizationFields(psql``)} FROM organizations
          WHERE github_app_installation_id = ${installationId}
          LIMIT 1
        `,
        )
        .then(OrganizationModel.nullable().parse);
    },
    async addSlackIntegration({ organizationId: organization, token }) {
      await pool.any(
        psql`/* addSlackIntegration */
          UPDATE organizations
          SET slack_token = ${token}
          WHERE id = ${organization}
        `,
      );
    },
    async deleteSlackIntegration({ organizationId: organization }) {
      await pool.any(
        psql`/* deleteSlackIntegration */
          UPDATE organizations
          SET slack_token = NULL
          WHERE id = ${organization}
        `,
      );
    },
    async getSlackIntegrationToken({ organizationId: organization }) {
      const result = await pool
        .maybeOne(
          psql`/* getSlackIntegrationToken */
            SELECT slack_token
            FROM organizations
            WHERE id = ${organization}
          `,
        )
        .then(z.object({ slack_token: z.string().nullable() }).nullable().parse);

      return result?.slack_token;
    },
    async addGitHubIntegration({ organizationId: organization, installationId }) {
      await pool.any(
        psql`/* addGitHubIntegration */
          UPDATE organizations
          SET github_app_installation_id = ${installationId}
          WHERE id = ${organization}
        `,
      );
    },
    async deleteGitHubIntegration({ organizationId: organization }) {
      await pool.any(
        psql`/* deleteGitHubIntegration */
          UPDATE organizations
          SET github_app_installation_id = NULL
          WHERE id = ${organization}
        `,
      );
      await pool.any(
        psql`/* resetProjectsGitHubRepository */
          UPDATE projects
          SET git_repository = NULL
          WHERE org_id = ${organization}
        `,
      );
    },
    async getGitHubIntegrationInstallationId({ organizationId: organization }) {
      return await pool
        .maybeOneFirst(
          psql`/* getGitHubIntegrationInstallationId */
            SELECT github_app_installation_id
            FROM organizations
            WHERE id = ${organization}
          `,
        )
        .then(z.string().nullable().parse);
    },
    async addAlertChannel({ projectId, name, type, slackChannel, webhookEndpoint }) {
      return AlertChannelModel.parse(
        await pool.maybeOne(
          psql`/* addAlertChannel */
            INSERT INTO alert_channels
              ("name", "type", "project_id", "slack_channel", "webhook_endpoint")
            VALUES
              (${name}, ${type}, ${projectId}, ${slackChannel ?? null}, ${webhookEndpoint ?? null})
            RETURNING
              ${alertChannelFields()}
          `,
        ),
      );
    },
    async deleteAlertChannels({ projectId, channelIds }) {
      return pool
        .any(
          psql`/* deleteAlertChannels */
          DELETE FROM alert_channels
          WHERE
            project_id = ${projectId} AND
            id IN (${psql.join(channelIds, psql.fragment`, `)})
          RETURNING
            ${alertChannelFields()}
        `,
        )
        .then(z.array(AlertChannelModel).parse);
    },
    async getAlertChannels({ projectId: project }) {
      return pool
        .any(
          psql`/* getAlertChannels */
          SELECT
            ${alertChannelFields()}
          FROM alert_channels
          WHERE project_id = ${project}
          ORDER BY created_at DESC`,
        )
        .then(z.array(AlertChannelModel).parse);
    },

    async addAlert({ organizationId, projectId, targetId, channelId, type }) {
      return {
        ...(await pool
          .maybeOne(
            psql`/* addAlert */
            INSERT INTO alerts
              ("type", "alert_channel_id", "target_id", "project_id")
            VALUES
              (${type}, ${channelId}, ${targetId}, ${projectId})
            RETURNING
              ${alertFields()}
          `,
          )
          .then(AlertModel.parse)),
        organizationId,
      };
    },
    async deleteAlerts({ organizationId: organization, projectId: project, alertIds: alerts }) {
      const result = await pool
        .any(
          psql`/* deleteAlerts */
          DELETE FROM alerts
          WHERE
            project_id = ${project} AND
            id IN (${psql.join(alerts, psql.fragment`, `)})
          RETURNING
            ${alertFields()}
        `,
        )
        .then(z.array(AlertModel).parse);

      return result.map(row => ({ ...row, organizationId: organization }));
    },
    async getAlerts({ organizationId: organization, projectId: project }) {
      const result = await pool
        .any(
          psql`/* getAlerts */
          SELECT
            ${alertFields()}
          FROM alerts
          WHERE project_id = ${project}
          ORDER BY created_at DESC`,
        )
        .then(z.array(AlertModel).parse);

      return result.map(row => ({ ...row, organizationId: organization }));
    },
    async adminGetOrganizationsTargetPairs() {
      const results = await pool
        .any(
          psql`/* adminGetOrganizationsTargetPairs */
          SELECT
            o.id as organization,
            t.id as target
          FROM targets AS t
          LEFT JOIN projects AS p ON (p.id = t.project_id)
          LEFT JOIN organizations AS o ON (o.id = p.org_id)
        `,
        )
        .then(z.array(OrganizationTargetPairModel).parse);
      return results;
    },
    async getGetOrganizationsAndTargetsWithLimitInfo() {
      return pool
        .any(
          psql`/* getGetOrganizationsAndTargetsWithLimitInfo */
            SELECT
              o.id as organization,
              o.clean_id as org_clean_id,
              o.name as org_name,
              o.limit_operations_monthly,
              o.limit_retention_days,
              o.plan_name as org_plan_name,
              array_agg(DISTINCT t.id)
                FILTER (WHERE t.id IS NOT NULL)
                as targets,
              split_part(
                string_agg(
                  DISTINCT u.email, ','
                ),
                ',',
                1
              ) AS owner_email
            FROM organizations AS o
            LEFT JOIN projects AS p ON (p.org_id = o.id)
            LEFT JOIN targets as t ON (t.project_id = p.id)
            LEFT JOIN users AS u ON (u.id = o.user_id)
            GROUP BY o.id
          `,
        )
        .then(
          z.array(
            z.object({
              organization: z.string(),
              org_name: z.string(),
              org_clean_id: z.string(),
              org_plan_name: z.string(),
              owner_email: z.string(),
              targets: z
                .array(z.string())
                .nullable()
                .transform(value => value ?? []),
              limit_operations_monthly: z.number(),
              limit_retention_days: z.number(),
            }),
          ).parse,
        );
    },
    async adminGetStats(period: { from: Date; to: Date }) {
      // count schema versions by organization
      const versionsResult = pool
        .any(
          psql`/* adminCountSchemaVersionsByOrg */
        SELECT
          COUNT(*) as total,
          o.id
        FROM schema_versions AS v
        LEFT JOIN targets AS t ON (t.id = v.target_id)
        LEFT JOIN projects AS p ON (p.id = t.project_id)
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        WHERE
          v.created_at >= ${period.from.toISOString()}
          AND
          v.created_at < ${period.to.toISOString()}
          AND (
            /* Legacy records */
            v.graph_metadata IS NULL
            OR (
              /* Default graph records, contract versions are excluded */
              v.graph_metadata->>'name' = 'default'
              AND v.graph_metadata->>'type' = 'default'
            )
          )
        GROUP by o.id
      `,
        )
        .then(z.array(OrganizationStatModel).parse);

      // count users by organization
      const usersResult = pool
        .any(
          psql`/* adminCountUsersByOrg */
        SELECT
          COUNT(*) as total,
          o.id
        FROM organization_member AS om
        LEFT JOIN organizations AS o ON (o.id = om.organization_id)
        GROUP by o.id
      `,
        )
        .then(z.array(OrganizationStatModel).parse);

      // count projects by organization
      const projectsResult = pool
        .any(
          psql`/* adminCountProjectsByOrg */
        SELECT
          COUNT(*) as total,
          o.id
        FROM projects AS p
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        GROUP by o.id
      `,
        )
        .then(z.array(OrganizationStatModel).parse);

      // count targets by organization
      const targetsResult = pool
        .any(
          psql`/* adminCountTargetsByOrg */
        SELECT
          COUNT(*) as total,
          o.id
        FROM targets AS t
        LEFT JOIN projects AS p ON (p.id = t.project_id)
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        GROUP by o.id
      `,
        )
        .then(z.array(OrganizationStatModel).parse);

      // get organizations data
      const organizationsResult = pool
        .any(
          psql`/* adminGetOrganizations */
        SELECT ${organizationFields(psql``)} FROM organizations
      `,
        )
        .then(z.array(OrganizationModel).parse);

      const [versions, users, projects, targets, organizations] = await Promise.all([
        versionsResult,
        usersResult,
        projectsResult,
        targetsResult,
        organizationsResult,
      ]);

      const rows: Array<{
        organization: Organization;
        versions: number;
        users: number;
        projects: number;
        targets: number;
        persistedOperations: number;
        period: {
          from: Date;
          to: Date;
        };
      }> = [];

      function extractTotal<
        T extends {
          total: number;
          id: string;
        },
      >(nodes: readonly T[], id: string) {
        return nodes.find(node => node.id === id)?.total ?? 0;
      }

      for (const organization of organizations) {
        rows.push({
          organization,
          versions: extractTotal(versions, organization.id),
          users: extractTotal(users, organization.id),
          projects: extractTotal(projects, organization.id),
          targets: extractTotal(targets, organization.id),
          persistedOperations: 0,
          period,
        });
      }

      return rows;
    },
    async getBaseSchema({ projectId: project, targetId: target }) {
      const data = await pool
        .maybeOne(
          psql`/* getBaseSchema */ SELECT base_schema FROM targets WHERE id=${target} AND project_id=${project}`,
        )
        .then(z.object({ base_schema: z.string().nullable() }).nullable().parse);
      return data?.base_schema ?? null;
    },
    async updateBaseSchema({ projectId: project, targetId: target }, base) {
      if (base) {
        await pool.query(
          psql`/* updateBaseSchema */ UPDATE targets SET base_schema = ${base} WHERE id = ${target} AND project_id = ${project}`,
        );
      } else {
        await pool.query(
          psql`/* resetBaseSchema */ UPDATE targets SET base_schema = null WHERE id = ${target} AND project_id = ${project}`,
        );
      }
    },
    async getBillingParticipants() {
      const results = await pool
        .any(
          psql`/* getBillingParticipants */
          SELECT
            "organization_id" AS "organizationId",
            "external_billing_reference_id" AS "externalBillingReference",
            "billing_email_address" AS "billingEmailAddress"
          FROM organizations_billing`,
        )
        .then(z.array(OrganizationBillingModel).parse);

      return results;
    },
    async getOrganizationBilling(selector) {
      const results = await pool
        .any(
          psql`/* getOrganizationBilling */
          SELECT
            "organization_id" AS "organizationId",
            "external_billing_reference_id" AS "externalBillingReference",
            "billing_email_address" AS "billingEmailAddress"
          FROM organizations_billing
          WHERE organization_id = ${selector.organizationId}`,
        )
        .then(z.array(OrganizationBillingModel).parse);

      return results[0] || null;
    },
    async deleteOrganizationBilling(selector) {
      await pool.any(
        psql`/* deleteOrganizationBilling */
          DELETE FROM organizations_billing
          WHERE organization_id = ${selector.organizationId}`,
      );
    },
    async createOrganizationBilling({
      billingEmailAddress,
      organizationId,
      externalBillingReference,
    }) {
      return OrganizationBillingModel.parse(
        await pool.maybeOne(
          psql`/* createOrganizationBilling */
            INSERT INTO organizations_billing
              ("organization_id", "external_billing_reference_id", "billing_email_address")
            VALUES
              (${organizationId}, ${externalBillingReference}, ${billingEmailAddress || null})
            RETURNING
              "organization_id" AS "organizationId",
              "external_billing_reference_id" AS "externalBillingReference",
              "billing_email_address" AS "billingEmailAddress"
          `,
        ),
      );
    },
    async completeGetStartedStep({ organizationId, step }) {
      await pool.query(psql`
        UPDATE
          "organizations"
        SET
          ${psql.identifier([organizationGetStartedMapping[step]])} = True
        WHERE
          "organizations"."id" = ${organizationId}
      `);
    },

    async getOIDCIntegrationById(args) {
      return shared.getOIDCIntegrationById(args, pool);
    },

    getOIDCIntegrationForOrganization: batch(async selectors => {
      const rows = await pool
        .any(
          psql`/* getOIDCIntegrationForOrganization */
        SELECT
          ${oidcIntegrationFields()}
        FROM
          "oidc_integrations"
        WHERE
          "linked_organization_id" = ANY(${psql.array(
            selectors.map(s => s.organizationId),
            'uuid',
          )})
      `,
        )
        .then(z.array(OIDCIntegrationModel).parse);
      const integrations = new Map(
        rows.map(integration => {
          return [integration.linkedOrganizationId, integration] as const;
        }),
      );

      return selectors.map(async s => integrations.get(s.organizationId) ?? null);
    }),

    async getOIDCIntegrationIdForOrganizationSlug({ slug }) {
      const id = await pool
        .maybeOneFirst(
          psql`/* getOIDCIntegrationIdForOrganizationSlug */
          SELECT
            "id"
          FROM
            "oidc_integrations"
          WHERE
            "linked_organization_id" = (
              SELECT "id"
              FROM "organizations"
              WHERE "clean_id" = ${slug}
              LIMIT 1
            )
          LIMIT 1
        `,
        )
        .then(z.string().nullable().parse);

      return id;
    },

    async createOIDCIntegrationForOrganization(args) {
      try {
        const oidcIntegration = await pool
          .maybeOne(
            psql`/* createOIDCIntegrationForOrganization */
          INSERT INTO "oidc_integrations" (
            "linked_organization_id",
            "client_id",
            "client_secret",
            "token_endpoint",
            "userinfo_endpoint",
            "authorization_endpoint",
            "additional_scopes",
            "user_id_claim"
          )
          VALUES (
            ${args.organizationId},
            ${args.clientId},
            ${args.encryptedClientSecret},
            ${args.tokenEndpoint},
            ${args.userinfoEndpoint},
            ${args.authorizationEndpoint},
            ${psql.array(args.additionalScopes, 'text')},
            ${args.userIdClaim}
          )
          RETURNING
            ${oidcIntegrationFields()}
        `,
          )
          .then(OIDCIntegrationModel.parse);

        return {
          type: 'ok',
          oidcIntegration,
        };
      } catch (error) {
        if (
          error instanceof UniqueIntegrityConstraintViolationError &&
          error.constraint === 'oidc_integrations_linked_organization_id_key'
        ) {
          return {
            type: 'error',
            reason: 'An OIDC integration already exists for this organization.',
          };
        }
        throw error;
      }
    },

    async updateOIDCIntegration(args) {
      return await pool
        .maybeOne(
          psql`/* updateOIDCIntegration */
        UPDATE "oidc_integrations"
        SET
          "client_id" = ${args.clientId ?? psql`"client_id"`}
          , "client_secret" = ${args.encryptedClientSecret ?? psql`"client_secret"`}
          , "token_endpoint" = ${
            args.tokenEndpoint ??
            /** update existing columns to the old legacy values if not yet stored */
            psql`COALESCE("token_endpoint", CONCAT("oauth_api_url", "/token"))`
          }
          , "userinfo_endpoint" = ${
            args.userinfoEndpoint ??
            /** update existing columns to the old legacy values if not yet stored */
            psql`COALESCE("userinfo_endpoint", CONCAT("oauth_api_url", "/userinfo"))`
          }
          , "authorization_endpoint" = ${
            args.authorizationEndpoint ??
            /** update existing columns to the old legacy values if not yet stored */
            psql`COALESCE("authorization_endpoint", CONCAT("oauth_api_url", "/authorize"))`
          }
          , "additional_scopes" = ${args.additionalScopes ? psql.array(args.additionalScopes, 'text') : psql`"additional_scopes"`}
          , "oauth_api_url" = NULL
          , "user_id_claim" = ${args.userIdClaim ?? psql`"user_id_claim"`}
        WHERE
          "id" = ${args.oidcIntegrationId}
        RETURNING
          ${oidcIntegrationFields()}
      `,
        )
        .then(OIDCIntegrationModel.parse);
    },

    async updateOIDCRestrictions(args) {
      return await pool
        .maybeOne(
          psql`/* updateOIDCRestrictions */
          UPDATE "oidc_integrations"
          SET
            "oidc_user_join_only" = ${args.oidcUserJoinOnly ?? psql`"oidc_user_join_only"`}
            , "oidc_user_access_only" = ${args.oidcUserAccessOnly ?? psql`"oidc_user_access_only"`}
            , "require_invitation" = ${args.requireInvitation ?? psql`"require_invitation"`}
            , "user_provisioning_required" = ${args.userProvisioningRequired ?? psql`"user_provisioning_required"`}
            , "oidc_for_verified_domains_required" = ${args.oidcForVerifiedDomainsRequired ?? psql`"oidc_for_verified_domains_required"`}
          WHERE
            "id" = ${args.oidcIntegrationId}
          RETURNING
           ${oidcIntegrationFields()}
      `,
        )
        .then(OIDCIntegrationModel.parse);
    },

    async updateOIDCDefaultAssignedResources(args) {
      return pool.transaction('updateOIDCDefaultAssignedResources', async trx => {
        return await trx
          .maybeOne(
            psql`/* updateOIDCDefaultAssignedResources */
          UPDATE "oidc_integrations"
          SET
            "default_assigned_resources" = ${psql.jsonb(args.assignedResources)}
          WHERE
            "id" = ${args.oidcIntegrationId}
          RETURNING
            ${oidcIntegrationFields()}
        `,
          )
          .then(OIDCIntegrationModel.parse);
      });
    },

    async updateOIDCDefaultMemberRole(args) {
      return pool.transaction('updateOIDCDefaultMemberRole', async trx => {
        // Make sure the role exists and is associated with the organization
        const roleId = await trx
          .oneFirst(
            psql`/* checkRoleExists */
            SELECT id FROM "organization_member_roles"
            WHERE
              "id" = ${args.roleId} AND
              "organization_id" = (
                SELECT "linked_organization_id" FROM "oidc_integrations" WHERE "id" = ${args.oidcIntegrationId}
              )
          `,
          )
          .then(z.string().parse);

        if (!roleId) {
          throw new Error('Role does not exist');
        }

        return await trx
          .maybeOne(
            psql`/* updateOIDCDefaultMemberRole */
          UPDATE "oidc_integrations"
          SET
            "default_role_id" = ${roleId}
          WHERE
            "id" = ${args.oidcIntegrationId}
          RETURNING
            ${oidcIntegrationFields()}
        `,
          )
          .then(OIDCIntegrationModel.parse);
      });
    },

    async deleteOIDCIntegration(args) {
      await pool.any(psql`/* deleteOIDCIntegration */
        DELETE FROM "oidc_integrations"
        WHERE
          "id" = ${args.oidcIntegrationId}
      `);
    },

    async createCDNAccessToken(args) {
      return await pool
        .maybeOne(
          psql`/* createCDNAccessToken */
        INSERT INTO "cdn_access_tokens" (
          "id"
          , "target_id"
          , "s3_key"
          , "first_characters"
          , "last_characters"
          , "alias"
        )
        VALUES (
          ${args.id}
          , ${args.targetId}
          , ${args.s3Key}
          , ${args.firstCharacters}
          , ${args.lastCharacters}
          , ${args.alias}
        )
        ON CONFLICT ("s3_key") DO NOTHING
        RETURNING
          ${cdnAccessTokenFields()}
      `,
        )
        .then(CDNAccessTokenModel.nullable().parse);
    },

    async getCDNAccessTokenById(args) {
      return await pool
        .maybeOne(
          psql`/* getCDNAccessTokenById */
        SELECT
          ${cdnAccessTokenFields()}
        FROM
          "cdn_access_tokens"
        WHERE
          "id" = ${args.cdnAccessTokenId}
      `,
        )
        .then(CDNAccessTokenModel.nullable().parse);
    },

    async deleteCDNAccessToken(args) {
      const result = await pool.maybeOne(psql`/* deleteCDNAccessToken */
        DELETE
        FROM
          "cdn_access_tokens"
        WHERE
          "id" = ${args.cdnAccessTokenId}
        RETURNING
          "id"
      `);

      return result != null;
    },

    async getPaginatedCDNAccessTokensForTarget(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      const result = await pool
        .any(
          psql`/* getPaginatedCDNAccessTokensForTarget */
        SELECT
          ${cdnAccessTokenFields()}
        FROM
          "cdn_access_tokens"
        WHERE
          "target_id" = ${args.targetId}
          ${
            cursor
              ? psql`
                AND (
                  (
                    "cdn_access_tokens"."created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "cdn_access_tokens"."created_at" < ${cursor.createdAt}
                )
              `
              : psql``
          }
        ORDER BY
          "target_id" ASC
          , "cdn_access_tokens"."created_at" DESC
          , "id" DESC
        LIMIT ${limit + 1}
      `,
        )
        .then(z.array(CDNAccessTokenModel).parse);

      let items = result.map(node => {
        return {
          node,
          get cursor() {
            return encodeCreatedAtAndUUIDIdBasedCursor(node);
          },
        };
      });

      const hasNextPage = items.length > limit;

      items = items.slice(0, limit);

      return {
        items,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: cursor !== null,
          get endCursor() {
            return items[items.length - 1]?.cursor ?? '';
          },
          get startCursor() {
            return items[0]?.cursor ?? '';
          },
        },
      };
    },

    async setSchemaPolicyForOrganization(input) {
      return pool
        .maybeOne(
          psql`/* setSchemaPolicyForOrganization */
        INSERT INTO "schema_policy_config"
        ("resource_type", "resource_id", "config", "allow_overriding")
          VALUES ('ORGANIZATION', ${input.organizationId}, ${psql.jsonb(input.policy)}, ${
            input.allowOverrides
          })
        ON CONFLICT
          (resource_type, resource_id)
        DO UPDATE
          SET "config" = ${psql.jsonb(input.policy)},
              "allow_overriding" = ${input.allowOverrides},
              "updated_at" = now()
        RETURNING ${schemaPolicyFields(psql``)};
      `,
        )
        .then(SchemaPolicyModel.parse);
    },
    async setSchemaPolicyForProject(input) {
      return pool
        .maybeOne(
          psql`/* setSchemaPolicyForProject */
      INSERT INTO "schema_policy_config"
      ("resource_type", "resource_id", "config")
        VALUES ('PROJECT', ${input.projectId}, ${psql.jsonb(input.policy)})
      ON CONFLICT
        (resource_type, resource_id)
      DO UPDATE
        SET "config" = ${psql.jsonb(input.policy)},
            "updated_at" = now()
      RETURNING ${schemaPolicyFields(psql``)};
    `,
        )
        .then(SchemaPolicyModel.parse);
    },
    async findInheritedPolicies(selector) {
      const { organizationId: organization, projectId: project } = selector;

      return pool
        .any(
          psql`/* findInheritedPolicies */
        SELECT ${schemaPolicyFields(psql``)}
        FROM
          "schema_policy_config"
        WHERE
          ("resource_type" = 'ORGANIZATION' AND "resource_id" = ${organization})
          OR ("resource_type" = 'PROJECT' AND "resource_id" = ${project});
      `,
        )
        .then(z.array(SchemaPolicyModel).parse);
    },
    async getSchemaPolicyForOrganization(organizationId: string) {
      return pool
        .maybeOne(
          psql`/* getSchemaPolicyForOrganization */
        SELECT ${schemaPolicyFields(psql``)}
        FROM
          "schema_policy_config"
        WHERE
          "resource_type" = 'ORGANIZATION'
          AND "resource_id" = ${organizationId};
      `,
        )
        .then(SchemaPolicyModel.nullable().parse);
    },
    async getSchemaPolicyForProject(projectId: string) {
      return pool
        .maybeOne(
          psql`/* getSchemaPolicyForProject */
      SELECT ${schemaPolicyFields(psql``)}
      FROM
        "schema_policy_config"
      WHERE
        "resource_type" = 'PROJECT'
        AND "resource_id" = ${projectId};
    `,
        )
        .then(SchemaPolicyModel.nullable().parse);
    },
    async getPaginatedDocumentCollectionsForTarget(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      const result = await pool.any(psql`/* getPaginatedDocumentCollectionsForTarget */
        SELECT
          "id"
          , "title"
          , "description"
          , "target_id" as "targetId"
          , "created_by_user_id" as "createdByUserId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
        FROM
          "document_collections"
        WHERE
          "target_id" = ${args.targetId}
          ${
            cursor
              ? psql`
                AND (
                  (
                    "created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "created_at" < ${cursor.createdAt}
                )
              `
              : psql``
          }
        ORDER BY
          "target_id" ASC
          , "created_at" DESC
          , "id" DESC
        LIMIT ${limit + 1}
      `);

      let items = result.map(row => {
        const node = DocumentCollectionModel.parse(row);

        return {
          node,
          get cursor() {
            return encodeCreatedAtAndUUIDIdBasedCursor(node);
          },
        };
      });

      const hasNextPage = items.length > limit;

      items = items.slice(0, limit);

      return {
        edges: items,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: cursor !== null,
          get endCursor() {
            return items[items.length - 1]?.cursor ?? '';
          },
          get startCursor() {
            return items[0]?.cursor ?? '';
          },
        },
      };
    },

    async createDocumentCollection(args) {
      const result = await pool.maybeOne(psql`/* createDocumentCollection */
        INSERT INTO "document_collections" (
          "title"
          , "description"
          , "target_id"
          , "created_by_user_id"
        )
        VALUES (
          ${args.title},
          ${args.description},
          ${args.targetId},
          ${args.createdByUserId}
        )
        RETURNING
          "id"
          , "title"
          , "description"
          , "target_id" as "targetId"
          , "created_by_user_id" as "createdByUserId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
      `);

      return DocumentCollectionModel.parse(result);
    },
    async deleteDocumentCollection(args) {
      const result = await pool.maybeOneFirst(psql`/* deleteDocumentCollection */
        DELETE
        FROM
          "document_collections"
        WHERE
          "id" = ${args.documentCollectionId}
        RETURNING
          "id"
      `);

      if (result == null) {
        return null;
      }

      return z.string().parse(result);
    },

    async updateDocumentCollection(args) {
      const result = await pool.maybeOne(psql`/* updateDocumentCollection */
        UPDATE
          "document_collections"
        SET
          "title" = COALESCE(${args.title}, "title")
          , "description" = COALESCE(${args.description}, "description")
          , "updated_at" = NOW()
        WHERE
          "id" = ${args.documentCollectionId}
        RETURNING
          "id"
          , "title"
          , "description"
          , "target_id" as "targetId"
          , "created_by_user_id" as "createdByUserId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
      `);

      if (result == null) {
        return null;
      }

      return DocumentCollectionModel.parse(result);
    },

    async getPaginatedDocumentsForDocumentCollection(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      // hard-coded max to prevent abuse (just in case, it's part of persisted operations anyway)
      const max = 200;
      const first = args.first && args.first > 0 ? args.first : max;
      const limit = Math.min(first, max);

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      const result = await pool.any(psql`/* getPaginatedDocumentsForDocumentCollection */
        SELECT
          "id"
          , "title"
          , "contents"
          , "variables"
          , "headers"
          , "created_by_user_id" as "createdByUserId"
          , "document_collection_id" as "documentCollectionId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
        FROM
          "document_collection_documents"
        WHERE
          "document_collection_id" = ${args.documentCollectionId}
          ${
            cursor
              ? psql`
                AND (
                  (
                    "created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "created_at" < ${cursor.createdAt}
                )
              `
              : psql``
          }
        ORDER BY
          "document_collection_id" ASC
          , "created_at" DESC
          , "id" DESC
        LIMIT ${limit + 1}
      `);

      let items = result.map(row => {
        const node = DocumentCollectionDocumentModel.parse(row);

        return {
          node,
          get cursor() {
            return encodeCreatedAtAndUUIDIdBasedCursor(node);
          },
        };
      });

      const hasNextPage = items.length > limit;

      items = items.slice(0, limit);

      return {
        edges: items,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: cursor !== null,
          get endCursor() {
            return items[items.length - 1]?.cursor ?? '';
          },
          get startCursor() {
            return items[0]?.cursor ?? '';
          },
        },
      };
    },

    async createDocumentCollectionDocument(args) {
      const result = await pool.maybeOne(psql`/* createDocumentCollectionDocument */
        INSERT INTO "document_collection_documents" (
          "title"
          , "contents"
          , "variables"
          , "headers"
          , "created_by_user_id"
          , "document_collection_id"
        )
        VALUES (
          ${args.title}
          , ${args.contents}
          , ${args.variables}
          , ${args.headers}
          , ${args.createdByUserId}
          , ${args.documentCollectionId}
        )
        RETURNING
          "id"
          , "title"
          , "contents"
          , "variables"
          , "headers"
          , "created_by_user_id" as "createdByUserId"
          , "document_collection_id" as "documentCollectionId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
      `);

      return DocumentCollectionDocumentModel.parse(result);
    },

    async deleteDocumentCollectionDocument(args) {
      const result = await pool.maybeOneFirst(psql`/* deleteDocumentCollectionDocument */
        DELETE
        FROM
          "document_collection_documents"
        WHERE
          "id" = ${args.documentCollectionDocumentId}
        RETURNING
          "id"
      `);

      if (result == null) {
        return null;
      }

      return z.string().parse(result);
    },

    async getDocumentCollectionDocument(args) {
      const result = await pool.maybeOne(psql`/* getDocumentCollectionDocument */
        SELECT
          "id"
          , "title"
          , "contents"
          , "variables"
          , "headers"
          , "created_by_user_id" as "createdByUserId"
          , "document_collection_id" as "documentCollectionId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
        FROM
          "document_collection_documents"
        WHERE
          "id" = ${args.id}
      `);

      if (result === null) {
        return null;
      }

      return DocumentCollectionDocumentModel.parse(result);
    },

    async getDocumentCollection(args) {
      const result = await pool.maybeOne(psql`/* getDocumentCollection */
        SELECT
          "id"
          , "title"
          , "description"
          , "target_id" as "targetId"
          , "created_by_user_id" as "createdByUserId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
        FROM
          "document_collections"
        WHERE
          "id" = ${args.id}
      `);

      if (result === null) {
        return null;
      }

      return DocumentCollectionModel.parse(result);
    },

    async updateDocumentCollectionDocument(args) {
      const result = await pool.maybeOne(psql`/* updateDocumentCollectionDocument */
        UPDATE
          "document_collection_documents"
        SET
          "title" = COALESCE(${args.title}, "title")
          , "contents" = COALESCE(${args.contents}, "contents")
          , "variables" = COALESCE(${args.variables}, "variables")
          , "headers" = COALESCE(${args.headers}, "headers")
          , "updated_at" = NOW()
        WHERE
          "id" = ${args.documentCollectionDocumentId}
        RETURNING
          "id"
          , "title"
          , "contents"
          , "variables"
          , "headers"
          , "created_by_user_id" as "createdByUserId"
          , "document_collection_id" as "documentCollectionId"
          , to_json("created_at") as "createdAt"
          , to_json("updated_at") as "updatedAt"
      `);

      if (result === null) {
        return null;
      }

      return DocumentCollectionDocumentModel.parse(result);
    },

    async createSchemaCheck(args) {
      const result = await pool.transaction('createSchemaCheck', async trx => {
        const sdlStoreInserts: Array<Promise<unknown>> = [];

        function insertSdl(hash: string, sdl: string) {
          return trx.any(psql`/* insertToSdlStore */
            INSERT INTO "sdl_store" (id, sdl)
            VALUES (${hash}, ${sdl})
            ON CONFLICT (id) DO NOTHING;
          `);
        }

        const schemaSDLHash = createSDLHash(args.schemaSDL);
        let baselineSchemaSdlHash: string | null = null;
        let baselinePublicSdlHash: string | null = null;
        let baselineSupergraphSdlHash: string | null = null;
        let compositeSchemaSdlHash: string | null = null;
        let supergraphSdlHash: string | null = null;

        sdlStoreInserts.push(insertSdl(schemaSDLHash, args.schemaSDL));

        if (args.baselineSchemaSdl) {
          baselineSchemaSdlHash = createSDLHash(args.baselineSchemaSdl);
          sdlStoreInserts.push(insertSdl(baselineSchemaSdlHash, args.baselineSchemaSdl));
        }

        if (args.baselinePublicSdl) {
          baselinePublicSdlHash = createSDLHash(args.baselinePublicSdl);
          sdlStoreInserts.push(insertSdl(baselinePublicSdlHash, args.baselinePublicSdl));
        }

        if (args.baselineSupergraphSdl) {
          baselineSupergraphSdlHash = createSDLHash(args.baselineSupergraphSdl);
          sdlStoreInserts.push(insertSdl(baselineSupergraphSdlHash, args.baselineSupergraphSdl));
        }

        if (args.compositeSchemaSDL) {
          compositeSchemaSdlHash = createSDLHash(args.compositeSchemaSDL);
          sdlStoreInserts.push(insertSdl(compositeSchemaSdlHash, args.compositeSchemaSDL));
        }

        if (args.supergraphSDL) {
          supergraphSdlHash = createSDLHash(args.supergraphSDL);
          sdlStoreInserts.push(insertSdl(supergraphSdlHash, args.supergraphSDL));
        }

        await Promise.all(sdlStoreInserts);

        const schemaCheck = await trx
          .maybeOne(
            psql`/* createSchemaCheck */
          INSERT INTO "schema_checks" (
              "schema_sdl_store_id"
            , "baseline_schema_sdl_store_id"
            , "baseline_supergraph_sdl_store_id"
            , "baseline_composite_schema_sdl_store_id"
            , "baseline_schema_composition_errors"
            , "baseline_schema_hash"
            , "service_name"
            , "service_url"
            , "meta"
            , "target_id"
            , "schema_version_id"
            , "is_success"
            , "schema_composition_errors"
            , "breaking_schema_changes"
            , "safe_schema_changes"
            , "schema_policy_warnings"
            , "schema_policy_errors"
            , "composite_schema_sdl_store_id"
            , "supergraph_sdl_store_id"
            , "is_manually_approved"
            , "manual_approval_user_id"
            , "github_check_run_id"
            , "github_repository"
            , "github_sha"
            , "expires_at"
            , "context_id"
            , "has_contract_schema_changes"
            , "conditional_breaking_change_metadata"
            , "schema_proposal_id"
            , "schema_proposal_changes"
          )
          VALUES (
              ${schemaSDLHash}
            , ${baselineSchemaSdlHash}
            , ${baselineSupergraphSdlHash}
            , ${baselinePublicSdlHash}
            , ${psql.jsonbOrNull(args.baselineSchemaCompositionErrors)}
            , ${args.baselineSchemaHash}
            , ${args.serviceName}
            , ${args.serviceUrl}
            , ${psql.jsonbOrNull(args.meta)}
            , ${args.targetId}
            , ${args.schemaVersionId}
            , ${args.isSuccess}
            , ${psql.jsonbOrNull(args.schemaCompositionErrors)}
            , ${psql.jsonbOrNull(args.breakingSchemaChanges?.map(toSerializableSchemaChange))}
            , ${psql.jsonbOrNull(args.safeSchemaChanges?.map(toSerializableSchemaChange))}
            , ${psql.jsonbOrNull(args.schemaPolicyWarnings?.map(w => SchemaPolicyWarningModel.parse(w)))}
            , ${psql.jsonbOrNull(args.schemaPolicyErrors?.map(w => SchemaPolicyWarningModel.parse(w)))}
            , ${compositeSchemaSdlHash}
            , ${supergraphSdlHash}
            , ${args.isManuallyApproved}
            , ${args.manualApprovalUserId}
            , ${args.githubCheckRunId}
            , ${args.githubRepository}
            , ${args.githubSha}
            , ${args.expiresAt?.toISOString() ?? null}
            , ${args.contextId}
            , ${
              args.contracts?.some(
                c => c.breakingSchemaChanges?.length || c.safeSchemaChanges?.length,
              ) ?? false
            }
            , ${psql.jsonbOrNull(InsertConditionalBreakingChangeMetadataModel.parse(args.conditionalBreakingChangeMetadata))}
            , ${args.schemaProposalId ?? null}
            , ${psql.jsonbOrNull(args.schemaProposalChanges?.map(toSerializableSchemaChange))}
          )
          RETURNING
            "id"
        `,
          )
          .then(z.object({ id: z.string() }).parse);

        if (args.contracts?.length) {
          for (const contract of args.contracts) {
            let supergraphSchemaSdlHash: string | null = null;
            let compositeSchemaSdlHash: string | null = null;
            let baselineSupergraphSchemaSdlHash: string | null = null;
            let baselinePublicSdlHash: string | null = null;

            const sdlInserts: Array<Promise<unknown>> = [];

            if (contract.supergraphSchemaSdl) {
              supergraphSchemaSdlHash = createSDLHash(contract.supergraphSchemaSdl);
              sdlInserts.push(insertSdl(supergraphSchemaSdlHash, contract.supergraphSchemaSdl));
            }

            if (contract.compositeSchemaSdl) {
              compositeSchemaSdlHash = createSDLHash(contract.compositeSchemaSdl);
              sdlInserts.push(insertSdl(compositeSchemaSdlHash, contract.compositeSchemaSdl));
            }

            if (contract.baselineSupergraphSchemaSdl) {
              baselineSupergraphSchemaSdlHash = createSDLHash(contract.baselineSupergraphSchemaSdl);
              sdlInserts.push(
                insertSdl(baselineSupergraphSchemaSdlHash, contract.baselineSupergraphSchemaSdl),
              );
            }

            if (contract.baselineCompositeSchemaSdl) {
              baselinePublicSdlHash = createSDLHash(contract.baselineCompositeSchemaSdl);
              sdlInserts.push(
                insertSdl(baselinePublicSdlHash, contract.baselineCompositeSchemaSdl),
              );
            }

            await Promise.all(sdlInserts);

            await trx.query(psql`/* createContractChecks */
              INSERT INTO "contract_checks" (
                "schema_check_id"
                , "compared_contract_version_id"
                , "is_success"
                , "contract_id"
                , "composite_schema_sdl_store_id"
                , "supergraph_sdl_store_id"
                , "schema_composition_errors"
                , "breaking_schema_changes"
                , "safe_schema_changes"
                , "baseline_supergraph_sdl_store_id"
                , "baseline_composite_schema_sdl_store_id"
                , "baseline_schema_composition_errors"
              )
              VALUES (
                ${schemaCheck.id}
                , ${contract.comparedContractVersionId}
                , ${contract.isSuccess}
                , ${contract.contractId}
                , ${compositeSchemaSdlHash}
                , ${supergraphSchemaSdlHash}
                , ${psql.jsonbOrNull(contract.schemaCompositionErrors)}
                , ${psql.jsonbOrNull(contract.breakingSchemaChanges?.map(toSerializableSchemaChange))}
                , ${psql.jsonbOrNull(contract.safeSchemaChanges?.map(toSerializableSchemaChange))}
                , ${baselineSupergraphSchemaSdlHash}
                , ${baselinePublicSdlHash}
                , ${psql.jsonbOrNull(contract.baselineCompositionErrors)}
              )
            `);
          }
        }

        return schemaCheck;
      });

      const check = await this.findSchemaCheck({
        targetId: args.targetId,
        schemaCheckId: result.id,
      });

      if (!check) {
        throw new Error('Failed to fetch newly created schema check');
      }

      return check;
    },
    async findSchemaCheck(args) {
      const result = await pool.maybeOne(psql`/* findSchemaCheck */
        SELECT
          ${schemaCheckSQLFields()}
        FROM
          "schema_checks" as c
        LEFT JOIN "sdl_store" as s_schema            ON s_schema."id" = c."schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_schema       ON s_baseline_schema."id" = c."baseline_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_public       ON s_baseline_public."id" = c."baseline_composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_supergraph   ON s_baseline_supergraph."id" = c."baseline_supergraph_sdl_store_id"
        LEFT JOIN "sdl_store" as s_composite_schema  ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_supergraph        ON s_supergraph."id" = c."supergraph_sdl_store_id"
        WHERE
          c."id" = ${args.schemaCheckId}
          AND c."target_id" = ${args.targetId}
      `);

      if (result == null) {
        return null;
      }

      return SchemaCheckModel.parse(result);
    },
    async approveFailedSchemaCheck(args) {
      const schemaCheck = await this.findSchemaCheck({
        targetId: args.targetId,
        schemaCheckId: args.schemaCheckId,
      });

      if (!schemaCheck) {
        return null;
      }

      // We enhance the approved schema checks with some metadata
      const approvalMetadata: SchemaCheckApprovalMetadata = {
        userId: args.userId,
        date: new Date().toISOString(),
        schemaCheckId: schemaCheck.id,
        author: args.author ?? undefined,
      };

      if (schemaCheck.contextId !== null && !!schemaCheck.breakingSchemaChanges) {
        // Try to approve and claim all the breaking schema changes for this context
        await pool.query(psql`/* approveFailedSchemaCheck */
          INSERT INTO "schema_change_approvals" (
            "target_id"
            , "context_id"
            , "schema_change_id"
            , "schema_change"
          )
          SELECT * FROM ${psql.unnest(
            schemaCheck.breakingSchemaChanges
              .filter(change => !change.isSafeBasedOnUsage)
              .map(change => [
                schemaCheck.targetId,
                schemaCheck.contextId,
                change.id,
                JSON.stringify(
                  toSerializableSchemaChange({
                    ...change,
                    // We enhance the approved schema changes with some metadata that can be displayed on the UI
                    approvalMetadata,
                  }),
                ),
              ]),
            ['uuid', 'text', 'text', 'jsonb'],
          )}
          ON CONFLICT ("target_id", "context_id", "schema_change_id") DO NOTHING
        `);
      }

      const didUpdateContractChecks = await args.contracts.approveContractChecksForSchemaCheckId({
        schemaCheckId: schemaCheck.id,
        approvalMetadata,
        contextId: schemaCheck.contextId,
      });

      let updateResult: {
        id: string;
      } | null = null;

      if (schemaCheck.breakingSchemaChanges) {
        updateResult = await pool
          .maybeOne(
            psql`/* approveFailedSchemaCheck (breakingSchemaChanges) */
            UPDATE
              "schema_checks"
            SET
              "is_success" = true
              , "is_manually_approved" = true
              , "manual_approval_user_id" = ${args.userId}
              , "manual_approval_comment" = ${args.comment ?? null}
              , "breaking_schema_changes" = (
                SELECT json_agg(
                  CASE
                    WHEN (COALESCE(jsonb_typeof("change"->'approvalMetadata'), 'null') = 'null' AND "change"->>'isSafeBasedOnUsage' = 'false')
                      THEN jsonb_set("change", '{approvalMetadata}', ${psql.jsonb(approvalMetadata)})
                    ELSE "change"
                  END
                )
                FROM jsonb_array_elements("breaking_schema_changes") AS "change"
              )
            WHERE
              "id" = ${args.schemaCheckId}
              AND "is_success" = false
              AND "schema_composition_errors" IS NULL
              AND "schema_policy_errors" IS NULL
            RETURNING
              "id"
          `,
          )
          .then(z.object({ id: z.string() }).nullable().parse);
      } else if (didUpdateContractChecks) {
        updateResult = await pool
          .maybeOne(
            psql`/* approveFailedSchemaCheck (didUpdateContractChecks) */
            UPDATE
              "schema_checks"
            SET
              "is_success" = true
              , "is_manually_approved" = true
              , "manual_approval_comment" = ${args.comment ?? null}
              , "manual_approval_user_id" = ${args.userId}
            WHERE
              "id" = ${args.schemaCheckId}
              AND "is_success" = false
              AND "schema_composition_errors" IS NULL
              AND "baseline_schema_composition_errors" IS NULL
              AND "schema_policy_errors" IS NULL
            RETURNING
              "id"
          `,
          )
          .then(z.object({ id: z.string() }).nullable().parse);
      }

      if (updateResult == null) {
        return null;
      }

      const result = await pool.maybeOne(psql`/* getApprovedSchemaCheck */
        SELECT
          ${schemaCheckSQLFields()}
        FROM
          "schema_checks" as c
        LEFT JOIN "sdl_store" as s_schema            ON s_schema."id" = c."schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_schema       ON s_baseline_schema."id" = c."baseline_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_public       ON s_baseline_public."id" = c."baseline_composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_supergraph   ON s_baseline_supergraph."id" = c."baseline_supergraph_sdl_store_id"
        LEFT JOIN "sdl_store" as s_composite_schema  ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_supergraph        ON s_supergraph."id" = c."supergraph_sdl_store_id"
        WHERE
          c."id" = ${updateResult.id}
      `);

      return SchemaCheckModel.parse(result);
    },
    async getApprovedSchemaChangesForContextId(args) {
      const result = await pool.anyFirst(psql`/* getApprovedSchemaChangesForContextId */
        SELECT
          "schema_change"
        FROM
          "schema_change_approvals"
        WHERE
          "target_id" = ${args.targetId}
          AND "context_id" = ${args.contextId}
      `);

      const approvedSchemaChanges = new Map<string, SchemaChangeType>();
      for (const record of result) {
        const change = HiveSchemaChangeModel.parse(record);
        approvedSchemaChanges.set(change.id, change);
      }
      return approvedSchemaChanges;
    },
    async getPaginatedSchemaChecksForTarget(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

      const { failed, changed, serviceName } = args.filters ?? {};

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      const result = await pool.any(psql`/* getPaginatedSchemaChecksForTarget */
        SELECT
          ${schemaCheckSQLFields({
            sdl: !!args.withSDL,
            changes: !!args.withChanges,
          })}
        FROM
          "schema_checks" as c
          ${
            args.withSDL
              ? psql`
                  LEFT JOIN "sdl_store" as s_schema            ON s_schema."id" = c."schema_sdl_store_id"
                  LEFT JOIN "sdl_store" as s_baseline_schema       ON s_baseline_schema."id" = c."baseline_schema_sdl_store_id"
                  LEFT JOIN "sdl_store" as s_baseline_public       ON s_baseline_public."id" = c."baseline_composite_schema_sdl_store_id"
                  LEFT JOIN "sdl_store" as s_baseline_supergraph   ON s_baseline_supergraph."id" = c."baseline_supergraph_sdl_store_id"
                  LEFT JOIN "sdl_store" as s_composite_schema  ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
                  LEFT JOIN "sdl_store" as s_supergraph        ON s_supergraph."id" = c."supergraph_sdl_store_id"
                `
              : psql``
          }
        WHERE
          c."target_id" = ${args.targetId}
          ${
            cursor
              ? psql`
                AND (
                  (
                    c."created_at" = ${cursor.createdAt}
                    AND c."id" < ${cursor.id}
                  )
                  OR c."created_at" < ${cursor.createdAt}
                )
              `
              : psql``
          }
          ${
            failed
              ? psql`
                AND (
                  "is_success" = false
                )
              `
              : psql``
          }
          ${
            changed
              ? psql`
                AND (
                  jsonb_typeof("safe_schema_changes") = 'array'
                  OR jsonb_typeof("breaking_schema_changes") = 'array'
                  OR "has_contract_schema_changes" = true
                )
              `
              : psql``
          }
          ${
            serviceName
              ? psql`
                AND c."service_name" = ${serviceName.toLowerCase()}
              `
              : psql``
          }
        ORDER BY
          c."target_id" ASC
          , c."created_at" DESC
          , c."id" DESC
        LIMIT ${limit + 1}
      `);

      let items = result.map(row => {
        const node = SchemaCheckModel.parse(row);

        return {
          get node() {
            // TODO: remove this any cast and fix the type issues...
            return (args.transformNode?.(node) ?? node) as any;
          },
          get cursor() {
            return encodeCreatedAtAndUUIDIdBasedCursor(node);
          },
        };
      });

      const hasNextPage = items.length > limit;

      items = items.slice(0, limit);

      return {
        items,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: cursor !== null,
          get endCursor() {
            return items[items.length - 1]?.cursor ?? '';
          },
          get startCursor() {
            return items[0]?.cursor ?? '';
          },
        },
      };
    },

    async getPaginatedSchemaChecksForSchemaProposal(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      // gets the most recently created schema checks per service name
      const result = await pool.any(psql`/* getPaginatedSchemaChecksForSchemaProposal */
        SELECT
          ${schemaCheckSQLFields()}
        FROM
          "schema_checks" as c
        ${
          args.latest
            ? psql`
            INNER JOIN (
              SELECT COALESCE("service_name", '') as "service", "schema_proposal_id", max("created_at") as "maxdate"
              FROM schema_checks
              ${
                cursor
                  ? psql`
                    WHERE "schema_proposal_id" = ${args.proposalId}
                    AND (
                      (
                        "created_at" = ${cursor.createdAt}
                        AND "id" < ${cursor.id}
                      )
                      OR "created_at" < ${cursor.createdAt}
                    )
                  `
                  : psql``
              }
              GROUP BY "service", "schema_proposal_id"
            ) as cc
            ON c."schema_proposal_id" = cc."schema_proposal_id"
              AND COALESCE(c."service_name", '') = cc."service"
              AND c."created_at" = cc."maxdate"
          `
            : psql``
        }
        LEFT JOIN "sdl_store" as s_schema
          ON s_schema."id" = c."schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_schema
          ON s_baseline_schema."id" = c."baseline_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_public
          ON s_baseline_public."id" = c."baseline_composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_baseline_supergraph
          ON s_baseline_supergraph."id" = c."baseline_supergraph_sdl_store_id"
        LEFT JOIN "sdl_store" as s_composite_schema
          ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_supergraph
          ON s_supergraph."id" = c."supergraph_sdl_store_id"
        WHERE
          c."schema_proposal_id" = ${args.proposalId}
          ${
            cursor
              ? psql`
                AND (
                  (
                    c."created_at" = ${cursor.createdAt}
                    AND c."id" < ${cursor.id}
                  )
                  OR c."created_at" < ${cursor.createdAt}
                )
              `
              : psql``
          }
        ORDER BY
          c."created_at" DESC
          , c."id" DESC
        LIMIT ${limit + 1}
      `);

      let items = result.map(row => {
        const node = SchemaCheckModel.parse(row);
        return {
          get node() {
            // TODO: remove this any cast and fix the type issues...
            return (args.transformNode?.(node) ?? node) as any;
          },
          get cursor() {
            return encodeCreatedAtAndUUIDIdBasedCursor(node);
          },
        };
      });

      const hasNextPage = items.length > limit;

      items = items.slice(0, limit);

      return {
        edges: items,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: cursor !== null,
          get endCursor() {
            return items[items.length - 1]?.cursor ?? '';
          },
          get startCursor() {
            return items[0]?.cursor ?? '';
          },
        },
      };
    },

    async purgeExpiredSchemaChecks(args) {
      const SchemaCheckModel = z.object({
        schemaCheckIds: z.array(z.string()),
        sdlStoreIds: z.array(z.string()),
        contextIds: z.array(z.string()),
        targetIds: z.array(z.string()),
        contractIds: z.array(z.string()),
      });
      return await pool.transaction('purgeExpiredSchemaChecks', async pool => {
        const date = args.expiresAt.toISOString();
        const rawData = await pool.maybeOne(psql`/* findSchemaChecksToPurge */
          WITH "filtered_schema_checks" AS (
            SELECT *
            FROM "schema_checks"
            WHERE "expires_at" <= ${date}
          )
          SELECT
            ARRAY(SELECT "filtered_schema_checks"."id" FROM "filtered_schema_checks") AS "schemaCheckIds",
            ARRAY(SELECT DISTINCT "filtered_schema_checks"."target_id" FROM "filtered_schema_checks") AS "targetIds",
            ARRAY(
              SELECT DISTINCT "filtered_schema_checks"."schema_sdl_store_id"
              FROM "filtered_schema_checks"
              WHERE "filtered_schema_checks"."schema_sdl_store_id" IS NOT NULL

              UNION SELECT DISTINCT "filtered_schema_checks"."baseline_schema_sdl_store_id"
              FROM "filtered_schema_checks"
              WHERE "filtered_schema_checks"."baseline_schema_sdl_store_id" IS NOT NULL

              UNION SELECT DISTINCT "filtered_schema_checks"."composite_schema_sdl_store_id"
              FROM "filtered_schema_checks"
              WHERE "filtered_schema_checks"."composite_schema_sdl_store_id" IS NOT NULL

              UNION SELECT DISTINCT "filtered_schema_checks"."supergraph_sdl_store_id"
              FROM "filtered_schema_checks"
              WHERE "filtered_schema_checks"."supergraph_sdl_store_id" IS NOT NULL

              UNION SELECT DISTINCT "contract_checks"."composite_schema_sdl_store_id"
              FROM "contract_checks"
                INNER JOIN "filtered_schema_checks" ON "contract_checks"."schema_check_id" = "filtered_schema_checks"."id"
              WHERE "contract_checks"."composite_schema_sdl_store_id" IS NOT NULL

              UNION SELECT DISTINCT "contract_checks"."supergraph_sdl_store_id" FROM "filtered_schema_checks"
                INNER JOIN "contract_checks" ON "contract_checks"."schema_check_id" = "filtered_schema_checks"."id"
                WHERE "contract_checks"."supergraph_sdl_store_id" IS NOT NULL
            ) AS "sdlStoreIds",
            ARRAY(
              SELECT DISTINCT "filtered_schema_checks"."context_id"
              FROM "filtered_schema_checks"
              WHERE "filtered_schema_checks"."context_id" IS NOT NULL
            ) AS "contextIds",
            ARRAY(
              SELECT DISTINCT "contract_checks"."contract_id"
              FROM "contract_checks"
                INNER JOIN "filtered_schema_checks" ON "contract_checks"."schema_check_id" = "filtered_schema_checks"."id"
            ) AS "contractIds"
        `);

        const data = SchemaCheckModel.parse(rawData);

        if (!data.schemaCheckIds.length) {
          return {
            deletedSchemaCheckCount: 0,
            deletedSdlStoreCount: 0,
            deletedSchemaChangeApprovalCount: 0,
            deletedContractSchemaChangeApprovalCount: 0,
          };
        }

        let deletedSdlStoreCount = 0;
        let deletedSchemaChangeApprovalCount = 0;
        let deletedContractSchemaChangeApprovalCount = 0;

        await pool.any(psql`/* purgeExpiredSchemaChecks */
          DELETE
          FROM "schema_checks"
          WHERE
            "id" = ANY(${psql.array(data.schemaCheckIds, 'uuid')})
        `);

        if (data.sdlStoreIds.length) {
          deletedSdlStoreCount = await pool
            .oneFirst(
              psql`/* purgeExpiredSdlStore */
            WITH "deleted" AS (
              DELETE
              FROM
                "sdl_store"
              WHERE
                "id" = ANY(
                  ${psql.array(data.sdlStoreIds, 'text')}
                )
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM
                    "schema_checks"
                  WHERE
                    "schema_checks"."schema_sdl_store_id" = "sdl_store"."id"
                    OR "schema_checks"."baseline_schema_sdl_store_id" = "sdl_store"."id"
                    OR "schema_checks"."composite_schema_sdl_store_id" = "sdl_store"."id"
                    OR "schema_checks"."supergraph_sdl_store_id" = "sdl_store"."id"
                )
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM
                    "contract_checks"
                  WHERE
                   "contract_checks"."composite_schema_sdl_store_id" = "sdl_store"."id"
                   OR "contract_checks"."supergraph_sdl_store_id" = "sdl_store"."id"
                )
              RETURNING
                "id"
            ) SELECT COUNT(*) FROM "deleted"
          `,
            )
            .then(z.number().parse);
        }

        if (data.targetIds.length && data.contextIds.length) {
          deletedSchemaChangeApprovalCount = await pool
            .oneFirst(
              psql`/* purgeExpiredSchemaChangeApprovals */
            WITH "deleted" AS (
              DELETE
              FROM
                "schema_change_approvals"
              WHERE
                "target_id" = ANY(
                  ${psql.array(data.targetIds, 'uuid')}
                )
                AND "context_id" = ANY(
                  ${psql.array(data.contextIds, 'text')}
                )
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM "schema_checks"
                  WHERE
                    "schema_checks"."target_id" = "schema_change_approvals"."target_id"
                    AND "schema_checks"."context_id" = "schema_change_approvals"."context_id"
                )
              RETURNING
                "target_id"
            ) SELECT COUNT(*) FROM "deleted"
          `,
            )
            .then(z.number().parse);
        }

        if (data.contractIds.length && data.contextIds.length) {
          deletedContractSchemaChangeApprovalCount = await pool
            .oneFirst(
              psql`/* purgeExpiredContractSchemaChangeApprovals */
            WITH "deleted" AS (
              DELETE
              FROM
                "contract_schema_change_approvals"
              WHERE
                "contract_id" = ANY(
                  ${psql.array(data.contractIds, 'uuid')}
                )
                AND "context_id" = ANY(
                  ${psql.array(data.contextIds, 'text')}
                )
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM
                    "schema_checks"
                      INNER JOIN "contract_checks"
                        ON "contract_checks"."schema_check_id" = "schema_checks"."id"
                  WHERE
                    "contract_checks"."contract_id" = "contract_schema_change_approvals"."contract_id"
                    AND "schema_checks"."context_id" = "contract_schema_change_approvals"."context_id"
                )
              RETURNING
                "contract_id"
            ) SELECT COUNT(*) FROM "deleted"
          `,
            )
            .then(z.number().parse);
        }

        return {
          deletedSchemaCheckCount: data.schemaCheckIds.length,
          deletedSdlStoreCount,
          deletedSchemaChangeApprovalCount,
          deletedContractSchemaChangeApprovalCount,
        };
      });
    },

    // Zendesk
    async setZendeskOrganizationId({ organizationId, zendeskId }) {
      await pool.query(psql`/* setZendeskOrganizationId */
        UPDATE
          "organizations"
        SET
          "zendesk_organization_id" = ${zendeskId}
        WHERE
          "id" = ${organizationId}
      `);
    },
    async setZendeskUserId({ userId, zendeskId }) {
      await pool.query(psql`/* setZendeskUserId */
        UPDATE
          "users"
        SET
          "zendesk_user_id" = ${zendeskId}
        WHERE
          "id" = ${userId}
      `);
    },
    async setZendeskOrganizationUserConnection({ organizationId, userId }) {
      await pool.query(psql`/* setZendeskOrganizationUserConnection */
        UPDATE
          "organization_member"
        SET
          "connected_to_zendesk" = true
        WHERE
          "organization_id" = ${organizationId}
          AND "user_id" = ${userId}
      `);
    },
    pool,
  };

  return storage;
}

export function encodeCreatedAtAndUUIDIdBasedCursor(cursor: { createdAt: string; id: string }) {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString('base64');
}

export function decodeCreatedAtAndUUIDIdBasedCursor(cursor: string) {
  const [createdAt, id] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
  if (
    Number.isNaN(Date.parse(createdAt)) ||
    id === undefined ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error('Invalid cursor');
  }

  return {
    createdAt,
    id,
  };
}

export function encodeAppDeploymentSortCursor(cursor: {
  sortField: string;
  sortValue: string | null;
  id: string;
}) {
  const value = cursor.sortValue ?? '';
  return Buffer.from(`${cursor.sortField}:${value}|${cursor.id}`).toString('base64');
}

export function decodeAppDeploymentSortCursor(cursor: string) {
  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const pipeIndex = decoded.lastIndexOf('|');
  if (pipeIndex === -1) {
    throw new Error('Invalid cursor');
  }
  const id = decoded.slice(pipeIndex + 1);
  const fieldAndValue = decoded.slice(0, pipeIndex);
  const colonIndex = fieldAndValue.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid cursor');
  }
  const sortField = fieldAndValue.slice(0, colonIndex);
  const validSortFields = ['CREATED_AT', 'ACTIVATED_AT', 'LAST_USED'];
  if (!validSortFields.includes(sortField)) {
    throw new Error('Invalid cursor: unknown sort field');
  }

  const sortValue = fieldAndValue.slice(colonIndex + 1) || null;
  if (sortValue !== null && Number.isNaN(new Date(sortValue).getTime())) {
    throw new Error('Invalid cursor: sortValue is not a valid date');
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid cursor');
  }

  return { sortField, sortValue, id };
}

export function encodeHashBasedCursor(cursor: { id: string }) {
  return Buffer.from(cursor.id).toString('base64');
}

export function decodeHashBasedCursor(cursor: string) {
  const id = Buffer.from(cursor, 'base64').toString('utf8');
  return {
    id,
  };
}

export function encodeCreatedAtAndHashBasedCursor(cursor: { createdAt: string; hash: string }) {
  return Buffer.from(`${cursor.createdAt}|${cursor.hash}`).toString('base64');
}

export function decodeCreatedAtAndHashBasedCursor(cursor: string) {
  const [createdAt, hash] = Buffer.from(cursor, 'base64').toString('utf8').split('|');

  return {
    createdAt,
    hash,
  };
}

const OIDCIntegrationBaseModel = z.object({
  id: z.string(),
  linkedOrganizationId: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  additionalScopes: z
    .array(z.string())
    .nullable()
    .transform(value => (value === null ? [] : value)),
  oidcUserJoinOnly: z.boolean(),
  oidcUserAccessOnly: z.boolean(),
  defaultRoleId: z.string().nullable(),
  defaultAssignedResources: z.any().nullable(),
  requireInvitation: z.boolean(),
  userIdClaim: z.string().nullable(),
  /** Whether a user needs to be provisioned before login. */
  userProvisioningRequired: z.boolean(),
  /** Whether a user with a verified domain needs to log in through the OIDC flow. */
  oidcForVerifiedDomainsRequired: z.boolean(),
});

const OIDCIntegrationLegacyModel = OIDCIntegrationBaseModel.extend({
  oauthApiUrl: z.string().url(),
}).transform(record => ({
  id: record.id,
  clientId: record.clientId,
  encryptedClientSecret: record.clientSecret,
  linkedOrganizationId: record.linkedOrganizationId,
  tokenEndpoint: `${record.oauthApiUrl}/token`,
  userinfoEndpoint: `${record.oauthApiUrl}/userinfo`,
  authorizationEndpoint: `${record.oauthApiUrl}/authorize`,
  additionalScopes: record.additionalScopes,
  oidcUserJoinOnly: record.oidcUserJoinOnly,
  oidcUserAccessOnly: record.oidcUserAccessOnly,
  requireInvitation: record.requireInvitation,
  defaultMemberRoleId: record.defaultRoleId,
  defaultResourceAssignment: record.defaultAssignedResources,
  userIdClaim: record.userIdClaim ?? 'sub',
  userProvisioningRequired: record.userProvisioningRequired,
  oidcForVerifiedDomainsRequired: record.oidcForVerifiedDomainsRequired,
}));

const LatestOIDCIntegrationModel = OIDCIntegrationBaseModel.extend({
  oauthApiUrl: z.null(),
  tokenEndpoint: z.string().url(),
  userinfoEndpoint: z.string().url(),
  authorizationEndpoint: z.string().url(),
}).transform(record => ({
  id: record.id,
  clientId: record.clientId,
  encryptedClientSecret: record.clientSecret,
  linkedOrganizationId: record.linkedOrganizationId,
  tokenEndpoint: record.tokenEndpoint,
  userinfoEndpoint: record.userinfoEndpoint,
  authorizationEndpoint: record.authorizationEndpoint,
  additionalScopes: record.additionalScopes,
  oidcUserJoinOnly: record.oidcUserJoinOnly,
  oidcUserAccessOnly: record.oidcUserAccessOnly,
  requireInvitation: record.requireInvitation,
  defaultMemberRoleId: record.defaultRoleId,
  defaultResourceAssignment: record.defaultAssignedResources,
  userIdClaim: record.userIdClaim ?? 'sub',
  userProvisioningRequired: record.userProvisioningRequired,
  oidcForVerifiedDomainsRequired: record.oidcForVerifiedDomainsRequired,
}));

const OIDCIntegrationModel = z.union([OIDCIntegrationLegacyModel, LatestOIDCIntegrationModel]);

const CDNAccessTokenModel = z.object({
  id: z.string(),
  targetId: z.string(),
  s3Key: z.string(),
  firstCharacters: z.string(),
  lastCharacters: z.string(),
  alias: z.string(),
  createdAt: z.string(),
});

export const FeatureFlagsModel = z
  .object({
    forceLegacyCompositionInTargets: z.array(z.string()).default([]),
    /** whether app deployments are enabled for the given organization */
    appDeployments: z.boolean().default(false),
    /** whether otel tracing is enabled for the given organization */
    otelTracing: z.boolean().default(false),
    schemaProposals: z.boolean().default(false),
    /** whether metric alert rules are enabled for the given organization */
    metricAlertRules: z.boolean().default(false),
    /** whether SCIM provisioning is enabled for the given organization */
    scim: z.boolean().default(false),
  })
  .optional()
  .nullable()
  .default({})
  .transform(
    val =>
      val ?? {
        forceLegacyCompositionInTargets: [],
        appDeployments: false,
        otelTracing: false,
        schemaProposals: false,
        metricAlertRules: false,
        scim: false,
      },
  );

const DocumentCollectionModel = z.object({
  id: z.string(),
  title: z.string(),
  description: z.union([z.string(), z.null()]),
  targetId: z.string(),
  createdByUserId: z.union([z.string(), z.null()]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const DocumentCollectionDocumentModel = z.object({
  id: z.string(),
  title: z.string(),
  contents: z.string(),
  variables: z.string().nullable(),
  headers: z.string().nullable(),
  createdByUserId: z.union([z.string(), z.null()]),
  documentCollectionId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Utility function for stripping a schema change of its computable properties for efficient storage in the database.
 */
export function toSerializableSchemaChange(change: SchemaChangeType): {
  id: string;
  type: string;
  meta: Record<string, SerializableValue>;
  approvalMetadata: null | {
    userId: string | null;
    date: string;
    schemaCheckId: string;
    author?: string;
  };
  isSafeBasedOnUsage: boolean;
  usageStatistics: null | {
    topAffectedOperations: Array<{
      name: string;
      hash: string;
      count: number;
    }>;
    topAffectedClients: Array<{
      name: string;
      count: number;
    }>;
  };
  affectedAppDeployments: null | AffectedAppDeployments;
} {
  return {
    id: change.id,
    type: change.type,
    meta: change.meta,
    isSafeBasedOnUsage: change.isSafeBasedOnUsage,
    approvalMetadata: change.approvalMetadata,
    usageStatistics: change.usageStatistics,
    affectedAppDeployments: change.affectedAppDeployments,
  };
}

const schemaCheckSQLFields = (include?: { sdl?: boolean; changes?: boolean }) => psql`
    c."id"
  , to_json(c."created_at") as "createdAt"
  , to_json(c."updated_at") as "updatedAt"
  ${
    (include?.sdl ?? true)
      ? psql`
        , coalesce(c."schema_sdl", s_schema."sdl") as "schemaSDL"
        , s_baseline_schema."sdl" as "baselineSchemaSDL"
        , s_baseline_public."sdl" as "baselinePublicSDL"
        , s_baseline_supergraph."sdl" as "baselineSupergraphSDL"
        , coalesce(c."composite_schema_sdl", s_composite_schema."sdl") as "compositeSchemaSDL"
        , coalesce(c."supergraph_sdl", s_supergraph."sdl") as "supergraphSDL"
      `
      : psql`
        , '' as "schemaSDL"
        , null as "baselineSchemaSDL"
        , null as "baselinePublicSDL"
        , null as "baselineSupergraphSDL"
        , null as "compositeSchemaSDL"
        , null as "supergraphSDL"
      `
  }
  , c."service_name" as "serviceName"
  , c."baseline_schema_hash" as "baselineSchemaHash"
  , c."baseline_schema_composition_errors" as "baselineCompositionErrors"
  , c."service_url" as "serviceUrl"
  , c."meta"
  , c."target_id" as "targetId"
  , c."schema_version_id" as "schemaVersionId"
  , c."is_success" as "isSuccess"
  , c."schema_composition_errors" as "schemaCompositionErrors"
  ${
    (include?.changes ?? true)
      ? psql`
        , c."breaking_schema_changes" as "breakingSchemaChanges"
        , c."safe_schema_changes" as "safeSchemaChanges"
      `
      : psql`
        , null as "breakingSchemaChanges"
        , null as "safeSchemaChanges"
      `
  }
  , c."schema_policy_warnings" as "schemaPolicyWarnings"
  , c."schema_policy_errors" as "schemaPolicyErrors"
  , c."github_check_run_id" as "githubCheckRunId"
  , c."github_repository" as "githubRepository"
  , c."github_sha" as "githubSha"
  , coalesce(c."is_manually_approved", false) as "isManuallyApproved"
  , c."manual_approval_user_id" as "manualApprovalUserId"
  , c."manual_approval_comment" as "manualApprovalComment"
  , c."context_id" as "contextId"
  , c."conditional_breaking_change_metadata" as "conditionalBreakingChangeMetadata"
  , c."schema_proposal_id" as "schemaProposalId"
  , c."schema_proposal_changes" as "schemaProposalChanges"
`;

export * from './schema-change-model';
export {
  buildRegistryServiceURLFromMeta,
  type RegistryServiceUrlChangeSerializableChange,
} from './schema-change-meta';

export type PaginatedOrganizationInvitationConnection = Readonly<{
  edges: ReadonlyArray<{
    cursor: string;
    node: OrganizationInvitation;
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;

const getOrganizationInvitationId = (keys: {
  organizationId: string;
  email: string;
  code: string;
}) => Buffer.from([keys.organizationId, keys.email, keys.code].join(':')).toString('hex');
const OrganizationInvitationModel = z
  .object({
    organizationId: z.string(),
    code: z.string(),
    email: z.string().email(),
    createdAt: z.string().transform(v => new Date(v).toISOString()),
    expiresAt: z.string().transform(v => new Date(v).toISOString()),
    roleId: z.string(),
    assignedResources: z.any(),
  })
  .transform(
    invitation =>
      ({
        ...invitation,
        get id(): string {
          return getOrganizationInvitationId(this);
        },
      }) as OrganizationInvitation,
  );

export const userFields = (user: TaggedTemplateLiteralInvocation) => psql`
  ${user}"id"
  , ${user}"email"
  , to_json(${user}"created_at") AS "createdAt"
  , ${user}"display_name" AS "displayName"
  , ${user}"full_name" AS "fullName"
  , ${user}"supertoken_user_id" AS "superTokensUserId"
  , ${user}"is_admin" AS "isAdmin"
  , ${user}"oidc_integration_id" AS "oidcIntegrationId"
  , ${user}"zendesk_user_id" AS "zendeskId"
  , ${user}"provisioned_by_organization_id" AS "provisionedByOrganizationId"
  , ${user}"provisioning_status" AS "provisioningStatus"
  , ${user}"external_id" AS "externalId"
  , to_json(${user}"deactivated_at") AS "deactivatedAt"
  , (
      SELECT ARRAY_AGG(DISTINCT "sub_stu"."third_party_id")
      FROM (
        SELECT ${user}"supertoken_user_id"::text "id"
        WHERE ${user}"supertoken_user_id" IS NOT NULL
        UNION
        SELECT "sub_uli"."identity_id"::text "id"
        FROM "users_linked_identities" "sub_uli"
        WHERE "sub_uli"."user_id" = ${user}"id"
      ) "sub_ids"
      LEFT JOIN "supertokens_thirdparty_users" "sub_stu"
      ON "sub_stu"."user_id" = "sub_ids"."id"
    ) AS "providers"
`;

const organizationFields = (prefix: TaggedTemplateLiteralInvocation) => psql`
  ${prefix}"id"
  , ${prefix}"clean_id" AS "slug"
  , ${prefix}"name"
  , ${prefix}"limit_retention_days" AS "limitRetentionDays"
  , ${prefix}"limit_operations_monthly" AS "limitOperationsMonthly"
  , ${prefix}"plan_name" AS "billingPlan"
  , ${prefix}"get_started_creating_project" AS "getStartedCreatingProject"
  , ${prefix}"get_started_publishing_schema" AS "getStartedPublishingSchema"
  , ${prefix}"get_started_checking_schema" AS "getStartedCheckingSchema"
  , ${prefix}"get_started_inviting_members" AS "getStartedInvitingMembers"
  , ${prefix}"get_started_reporting_operations" AS "getStartedReportingOperations"
  , ${prefix}"get_started_usage_breaking" AS "getStartedUsageBreaking"
  , ${prefix}"feature_flags" AS "featureFlags"
  , ${prefix}"zendesk_organization_id" AS "zendeskId"
  , ${prefix}"user_id" AS "ownerId"
`;

const schemaPolicyFields = (prefix: TaggedTemplateLiteralInvocation) => psql`
  ${prefix}"resource_type" AS "resourceType"
  , ${prefix}"resource_id" AS "resourceId"
  , ${prefix}"config"
  , ${prefix}"allow_overriding" AS "allowOverrides"
  , to_json(${prefix}"created_at") AS "createdAt"
  , to_json(${prefix}"updated_at") AS "updatedAt"
`;

const alertChannelFields = (prefix: TaggedTemplateLiteralInvocation = psql``) => psql`
  ${prefix}"id" AS "id",
  ${prefix}"name" AS "name",
  ${prefix}"type" AS "type",
  ${prefix}"project_id" AS "projectId",
  to_json(${prefix}"created_at") AS "createdAt",
  ${prefix}"slack_channel" AS "slackChannel",
  ${prefix}"webhook_endpoint" AS "webhookEndpoint"
`;

const alertFields = (prefix: TaggedTemplateLiteralInvocation = psql``) => psql`
  ${prefix}"id" AS "id",
  ${prefix}"type" AS "type",
  to_json(${prefix}"created_at") AS "createdAt",
  ${prefix}"alert_channel_id" AS "channelId",
  ${prefix}"project_id" AS "projectId",
  ${prefix}"target_id" AS "targetId"
`;

const cdnAccessTokenFields = (prefix: TaggedTemplateLiteralInvocation = psql``) => psql`
  ${prefix}"id" AS "id"
  , ${prefix}"target_id" AS "targetId"
  , ${prefix}"s3_key" AS "s3Key"
  , ${prefix}"first_characters" AS "firstCharacters"
  , ${prefix}"last_characters" AS "lastCharacters"
  , ${prefix}"alias" AS "alias"
  , to_json(${prefix}"created_at") as "createdAt"
`;

const oidcIntegrationFields = (prefix: TaggedTemplateLiteralInvocation = psql``) => psql`
  ${prefix}"id" AS "id"
  , ${prefix}"linked_organization_id" AS "linkedOrganizationId"
  , ${prefix}"client_id" AS "clientId"
  , ${prefix}"client_secret" AS "clientSecret"
  , ${prefix}"oauth_api_url" AS "oauthApiUrl"
  , ${prefix}"token_endpoint" AS "tokenEndpoint"
  , ${prefix}"userinfo_endpoint" AS "userinfoEndpoint"
  , ${prefix}"authorization_endpoint" AS "authorizationEndpoint"
  , ${prefix}"additional_scopes" AS "additionalScopes"
  , ${prefix}"oidc_user_join_only" AS "oidcUserJoinOnly"
  , ${prefix}"oidc_user_access_only" AS "oidcUserAccessOnly"
  , ${prefix}"default_role_id" AS "defaultRoleId"
  , ${prefix}"default_assigned_resources" AS "defaultAssignedResources"
  , ${prefix}"require_invitation" AS "requireInvitation"
  , ${prefix}"user_id_claim" AS "userIdClaim"
  , ${prefix}"user_provisioning_required" AS "userProvisioningRequired"
  , ${prefix}"oidc_for_verified_domains_required" AS "oidcForVerifiedDomainsRequired"
`;

const OrganizationModel = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    limitRetentionDays: z.number(),
    limitOperationsMonthly: z.number(),
    billingPlan: z.string(),
    getStartedCreatingProject: z.boolean(),
    getStartedPublishingSchema: z.boolean(),
    getStartedCheckingSchema: z.boolean(),
    getStartedInvitingMembers: z.boolean(),
    getStartedReportingOperations: z.boolean(),
    getStartedUsageBreaking: z.boolean(),
    featureFlags: FeatureFlagsModel,
    zendeskId: z.string().nullable(),
    ownerId: z.string(),
  })
  .transform(org => ({
    id: org.id,
    slug: org.slug,
    name: org.name,
    billingPlan: org.billingPlan,
    monthlyRateLimit: {
      retentionInDays: org.limitRetentionDays,
      operations: org.limitOperationsMonthly,
    },
    getStarted: {
      id: org.id,
      creatingProject: org.getStartedCreatingProject,
      publishingSchema: org.getStartedPublishingSchema,
      checkingSchema: org.getStartedCheckingSchema,
      invitingMembers: org.getStartedInvitingMembers,
      reportingOperations: org.getStartedReportingOperations,
      enablingUsageBasedBreakingChanges: org.getStartedUsageBreaking,
    },
    featureFlags: org.featureFlags,
    zendeskId: org.zendeskId,
    ownerId: org.ownerId,
  }));

const OrganizationBillingModel = z.object({
  organizationId: z.string(),
  externalBillingReference: z.string(),
  billingEmailAddress: z.string().nullable(),
});

const AlertChannelModel = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['DISCORD', 'MSTEAMS_WEBHOOK', 'SLACK', 'WEBHOOK']),
  projectId: z.string(),
  createdAt: z.string(),
  slackChannel: z.string().nullable(),
  webhookEndpoint: z.string().nullable(),
});

const AlertModel = z.object({
  id: z.string(),
  type: z.enum(['SCHEMA_CHANGE_NOTIFICATIONS']),
  createdAt: z.string(),
  channelId: z.string(),
  projectId: z.string(),
  targetId: z.string(),
});

const OrganizationUserIdAndIdModel = z.object({
  id: z.string(),
  user_id: z.string(),
});

const SchemaPolicyModel = z
  .object({
    resourceType: z.enum(['ORGANIZATION', 'PROJECT']),
    resourceId: z.string(),
    config: z.any(),
    allowOverrides: z.boolean(),
    createdAt: z.string().transform(t => new Date(t)),
    updatedAt: z.string().transform(t => new Date(t)),
  })
  .transform(sp => ({
    id: `${sp.resourceType}_${sp.resourceId}`,
    config: sp.config,
    createdAt: sp.createdAt,
    updatedAt: sp.updatedAt,
    resource: sp.resourceType,
    resourceId: sp.resourceId,
    allowOverrides: sp.allowOverrides,
  }));

const MemberModel = z
  .object({
    id: z.string(),
    isOwner: z.boolean(),
    scopes: z.array(z.string()).nullable(),
    organizationId: z.string(),
    oidcIntegrationId: z.string().nullable(),
    connectedToZendesk: z.boolean().nullable(),
    roleId: z.string(),
    roleName: z.string(),
    roleLocked: z.boolean(),
    roleDescription: z.string(),
    roleScopes: z.array(z.string()).nullable(),
    // user fields are also present in the row
    email: z.string(),
    createdAt: z.string(),
    displayName: z.string(),
    fullName: z.string(),
    superTokensUserId: z.string().nullable(),
    isAdmin: z
      .boolean()
      .nullable()
      .transform(value => value ?? false),
    zendeskId: z.string().nullable(),
    providers: z.array(
      z
        .string()
        .nullable()
        .transform(provider => {
          if (provider === 'oidc') {
            return 'OIDC' as const;
          }
          if (provider === 'github') {
            return 'GITHUB' as const;
          }
          if (provider === 'google') {
            return 'GOOGLE' as const;
          }
          return null;
        }),
    ),
    deactivatedAt: z.string().nullable(),
    provisionedByOrganizationId: z.string().nullable(),
    provisioningStatus: z.enum(['pendingConfirmation', 'active']).nullable(),
    externalId: z.string().nullable(),
  })
  .transform(row => ({
    id: row.id,
    isOwner: row.isOwner,
    user: UserModel.parse({
      ...row,
      providers: row.providers.filter((p): p is NonNullable<typeof p> => p != null),
    }),
    scopes: (row.scopes as Member['scopes']) || [],
    organization: row.organizationId,
    oidcIntegrationId: row.oidcIntegrationId ?? null,
    connectedToZendesk: row.connectedToZendesk ?? false,
    role: {
      id: row.roleId,
      name: row.roleName,
      locked: row.roleLocked,
      description: row.roleDescription,
      scopes: (row.roleScopes as Member['scopes']) ?? [],
      organizationId: row.organizationId,
      membersCount: undefined as number | undefined,
    },
  }));

const OrganizationMemberAccessModel = z.object({
  organization_id: z.string(),
  user_id: z.string(),
  scopes: z.array(z.string()).nullable(),
});

const OrganizationTargetPairModel = z.object({
  organization: z.string(),
  target: z.string(),
});

const OrganizationStatModel = z.object({
  id: z.string(),
  total: z.number(),
});

const UserBase = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),
  displayName: z.string(),
  fullName: z.string(),
  superTokensUserId: z.string().nullable(),
  isAdmin: z
    .boolean()
    .nullable()
    .transform(value => value ?? false),
  oidcIntegrationId: z.string().nullable(),
  zendeskId: z.string().nullable(),
  providers: z.array(
    z
      .string()
      .nullable()
      .transform(provider => {
        if (provider === 'oidc') {
          return 'OIDC' as const;
        }
        if (provider === 'google') {
          return 'GOOGLE' as const;
        }
        if (provider === 'github') {
          return 'GITHUB' as const;
        }
        return 'USERNAME_PASSWORD' as const;
      }),
  ),
  deactivatedAt: z.string().nullable(),
});

export const UserModel = z.union([
  UserBase.extend({
    provisionedByOrganizationId: z.string().uuid(),
    provisioningStatus: z.enum(['pendingConfirmation', 'active']),
    externalId: z.string(),
  }),
  UserBase.extend({
    provisionedByOrganizationId: z.null(),
    provisioningStatus: z.null(),
    externalId: z.string().nullable(),
  }),
]);

export type UserType = z.TypeOf<typeof UserModel>;
