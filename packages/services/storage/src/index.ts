import {
  DatabasePool,
  DatabaseTransactionConnection,
  SerializableValue,
  sql,
  TaggedTemplateLiteralInvocation,
  UniqueIntegrityConstraintViolationError,
} from 'slonik';
import { update } from 'slonik-utilities';
import zod from 'zod';
import type {
  ActivityObject,
  Alert,
  AlertChannel,
  AuthProvider,
  Member,
  Organization,
  OrganizationBilling,
  OrganizationInvitation,
  Project,
  Schema,
  Storage,
  TargetSettings,
  User,
} from '@hive/api';
import { batch } from '@theguild/buddy';
import {
  OrganizationMemberRoleModel,
  ProjectType,
  type CDNAccessToken,
  type OIDCIntegration,
  type SchemaLog,
  type SchemaPolicy,
} from '../../api/src/shared/entities';
import {
  activities,
  alert_channels,
  alerts,
  getPool,
  objectToParams,
  organization_invitations,
  organization_member,
  organization_member_roles,
  organizations,
  organizations_billing,
  projects,
  schema_log as schema_log_in_db,
  schema_policy_config,
  schema_version_to_log,
  schema_versions,
  target_validation,
  targets,
  tokens,
  users,
} from './db';
import {
  HiveSchemaChangeModel,
  SchemaCheckModel,
  SchemaCompositionErrorModel,
  SchemaPolicyWarningModel,
  TargetBreadcrumbModel,
  type SchemaChangeType,
  type SchemaCheckApprovalMetadata,
  type SchemaCompositionError,
} from './schema-change-model';
import type { Slonik } from './shared';

export { ConnectionError } from 'slonik';
export { createConnectionString } from './db/utils';
export { createTokenStorage } from './tokens';
export type { tokens, schema_policy_resource } from './db/types';

type Connection = DatabasePool | DatabaseTransactionConnection;

type OverrideProp<T extends {}, K extends keyof T, V extends T[K]> = Omit<T, K> & { [P in K]: V };

type schema_log = Omit<schema_log_in_db, 'action'> & {
  action: 'PUSH' | 'DELETE';
};

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

function ensureDefined<T>(value: T | null | undefined, propertyName: string): T {
  if (value == null) {
    throw new Error(`${propertyName} is null or undefined`);
  }

  return value;
}

function resolveAuthProviderOfUser(
  user: users & {
    provider: string | null | undefined;
  },
): AuthProvider {
  // TODO: remove this once we have migrated all users
  if (user.external_auth_user_id) {
    if (user.external_auth_user_id.startsWith('github')) {
      return 'GITHUB';
    }

    if (user.external_auth_user_id.startsWith('google')) {
      return 'GOOGLE';
    }

    return 'USERNAME_PASSWORD';
  }

  if (user.provider === 'oidc') {
    return 'OIDC';
  }
  if (user.provider === 'google') {
    return 'GOOGLE';
  }
  if (user.provider === 'github') {
    return 'GITHUB';
  }

  return 'USERNAME_PASSWORD';
}

type MemberRoleColumns =
  | {
      role_id: organization_member_roles['id'];
      role_name: organization_member_roles['name'];
      role_description: organization_member_roles['description'];
      role_locked: organization_member_roles['locked'];
      role_scopes: organization_member_roles['scopes'];
    }
  | {
      role_id: null;
      role_name: null;
      role_description: null;
      role_locked: null;
      role_scopes: null;
    };

export async function createStorage(connection: string, maximumPoolSize: number): Promise<Storage> {
  const pool = await getPool(connection, maximumPoolSize);

  function transformUser(
    user: users & {
      provider: string | null | undefined;
    },
  ): User {
    return {
      id: user.id,
      email: user.email,
      superTokensUserId: user.supertoken_user_id,
      provider: resolveAuthProviderOfUser(user),
      fullName: user.full_name,
      displayName: user.display_name,
      isAdmin: user.is_admin ?? false,
      externalAuthUserId: user.external_auth_user_id ?? null,
      oidcIntegrationId: user.oidc_integration_id ?? null,
      zendeskId: user.zendesk_user_id ?? null,
    };
  }

  function transformSchemaPolicy(schema_policy: schema_policy_config): SchemaPolicy {
    return {
      id: `${schema_policy.resource_type}_${schema_policy.resource_id}`,
      config: schema_policy.config,
      createdAt: schema_policy.created_at,
      updatedAt: schema_policy.updated_at,
      resource: schema_policy.resource_type,
      resourceId: schema_policy.resource_id,
      allowOverrides: schema_policy.allow_overriding,
    };
  }

  function transformMember(
    user: users &
      Pick<organization_member, 'scopes' | 'organization_id' | 'connected_to_zendesk'> & {
        is_owner: boolean;
      } & MemberRoleColumns & {
        provider: string | null;
      },
  ): Member {
    return {
      id: user.id,
      isOwner: user.is_owner,
      user: transformUser(user),
      // This allows us to have a fallback for users that don't have a role, remove this once we all users have a role
      scopes: (user.scopes as Member['scopes']) || [],
      organization: user.organization_id,
      oidcIntegrationId: user.oidc_integration_id ?? null,
      connectedToZendesk: user.connected_to_zendesk ?? false,
      role: user.role_id
        ? {
            id: user.role_id,
            name: user.role_name,
            locked: user.role_locked,
            description: user.role_description,
            scopes: user.role_scopes as Member['scopes'],
            organizationId: user.organization_id,
            membersCount: undefined, // if it's not defined, the resolver will fetch it
          }
        : null,
    };
  }

  function transformOrganization(organization: organizations): Organization {
    return {
      id: organization.id,
      cleanId: organization.clean_id,
      name: organization.name,
      monthlyRateLimit: {
        retentionInDays: parseInt(organization.limit_retention_days),
        operations: parseInt(organization.limit_operations_monthly),
      },
      billingPlan: organization.plan_name,
      getStarted: {
        id: organization.id,
        creatingProject: organization.get_started_creating_project,
        publishingSchema: organization.get_started_publishing_schema,
        checkingSchema: organization.get_started_checking_schema,
        invitingMembers: organization.get_started_inviting_members,
        reportingOperations: organization.get_started_reporting_operations,
        enablingUsageBasedBreakingChanges: organization.get_started_usage_breaking,
      },
      featureFlags: decodeFeatureFlags(organization.feature_flags),
      zendeskId: organization.zendesk_organization_id ?? null,
    };
  }

  function transformOrganizationInvitation(
    invitation: organization_invitations & {
      role: organization_member_roles;
    },
  ): OrganizationInvitation {
    return {
      email: invitation.email,
      organization_id: invitation.organization_id,
      code: invitation.code,
      created_at: invitation.created_at as any,
      expires_at: invitation.expires_at as any,
      role: OrganizationMemberRoleModel.parse(invitation.role),
    };
  }

  function transformProject(project: projects): Project {
    return {
      id: project.id,
      cleanId: project.clean_id,
      orgId: project.org_id,
      name: project.name,
      type: project.type as ProjectType,
      buildUrl: project.build_url,
      validationUrl: project.validation_url,
      gitRepository: project.git_repository as `${string}/${string}` | null,
      legacyRegistryModel: project.legacy_registry_model,
      useProjectNameInGithubCheck: project.github_check_with_project_name === true,
      externalComposition: {
        enabled: project.external_composition_enabled,
        endpoint: project.external_composition_endpoint,
        encryptedSecret: project.external_composition_secret,
      },
      nativeFederation: project.native_federation === true,
    };
  }

  function transformSchema(
    schema: Pick<
      OverrideProp<schema_log, 'action', 'PUSH'>,
      | 'id'
      | 'action'
      | 'commit'
      | 'author'
      | 'sdl'
      | 'created_at'
      | 'project_id'
      | 'service_name'
      | 'service_url'
      | 'target_id'
      | 'metadata'
    > &
      Pick<projects, 'type'>,
  ): Schema {
    const isSingleProject = (schema.type as ProjectType) === ProjectType.SINGLE;
    const record: Schema = isSingleProject
      ? {
          kind: 'single',
          id: schema.id,
          author: schema.author,
          sdl: ensureDefined(schema.sdl, 'sdl'),
          commit: schema.commit,
          date: schema.created_at as any,
          target: schema.target_id,
          metadata: schema.metadata ?? null,
        }
      : {
          kind: 'composite',
          id: schema.id,
          author: schema.author,
          sdl: ensureDefined(schema.sdl, 'sdl'),
          commit: schema.commit,
          date: schema.created_at as any,
          service_name: schema.service_name!,
          service_url: schema.service_url,
          target: schema.target_id,
          action: 'PUSH',
          metadata: schema.metadata ?? null,
        };

    return record;
  }

  function transformSchemaLog(
    schema: Pick<
      schema_log,
      | 'id'
      | 'action'
      | 'commit'
      | 'author'
      | 'sdl'
      | 'created_at'
      | 'project_id'
      | 'service_name'
      | 'service_url'
      | 'target_id'
      | 'metadata'
    > &
      Pick<projects, 'type'>,
  ): SchemaLog {
    const isSingleProject = (schema.type as ProjectType) === ProjectType.SINGLE;
    const record: SchemaLog = isSingleProject
      ? {
          kind: 'single',
          id: schema.id,
          author: schema.author,
          sdl: ensureDefined(schema.sdl, 'sdl'),
          commit: schema.commit,
          date: schema.created_at as any,
          target: schema.target_id,
          metadata: schema.metadata ?? null,
        }
      : schema.action === 'PUSH'
        ? {
            kind: 'composite',
            id: schema.id,
            author: schema.author,
            sdl: ensureDefined(schema.sdl, 'sdl'),
            commit: schema.commit,
            date: schema.created_at as any,
            service_name: schema.service_name!,
            service_url: schema.service_url,
            target: schema.target_id,
            action: 'PUSH',
            metadata: schema.metadata ?? null,
          }
        : {
            kind: 'composite',
            id: schema.id,
            date: schema.created_at as any,
            service_name: schema.service_name!,
            target: schema.target_id,
            action: 'DELETE',
          };

    return record;
  }

  function transformActivity(row: {
    activity: [activities];
    target: [Record<string, unknown>];
    project: [projects];
    organization: [organizations];
    user: [users];
  }): ActivityObject {
    const activity = row.activity[0];
    const target = row.target[0];
    const project = row.project[0];
    const organization = row.organization[0];
    const user = row.user[0];

    return {
      id: activity.id,
      type: activity.activity_type,
      meta: activity.activity_metadata,
      createdAt: activity.created_at,
      target: target['id']
        ? {
            ...TargetModel.parse(target),
            orgId: organization.id,
          }
        : undefined,
      project: project ? transformProject(project) : undefined,
      organization: transformOrganization(organization),
      user: user
        ? transformUser({
            ...user,
            provider: null, // we don't need this for activities
          })
        : undefined,
    };
  }

  function transformTargetSettings(
    row: Pick<
      targets,
      | 'validation_enabled'
      | 'validation_percentage'
      | 'validation_period'
      | 'validation_excluded_clients'
    > & {
      targets: target_validation['destination_target_id'][] | null;
    },
  ): TargetSettings {
    return {
      validation: {
        enabled: row.validation_enabled,
        percentage: row.validation_percentage,
        period: row.validation_period,
        targets: Array.isArray(row.targets) ? row.targets.filter(isDefined) : [],
        excludedClients: Array.isArray(row.validation_excluded_clients)
          ? row.validation_excluded_clients.filter(isDefined)
          : [],
      },
    };
  }

  function transformOrganizationBilling(orgBilling: organizations_billing): OrganizationBilling {
    return {
      organizationId: orgBilling.organization_id,
      externalBillingReference: orgBilling.external_billing_reference_id,
      billingEmailAddress: orgBilling.billing_email_address,
    };
  }

  function transformAlertChannel(channel: alert_channels): AlertChannel {
    return {
      id: channel.id,
      projectId: channel.project_id,
      name: channel.name,
      type: channel.type,
      createdAt: channel.created_at as any,
      slackChannel: channel.slack_channel,
      webhookEndpoint: channel.webhook_endpoint,
    };
  }

  function transformAlert(alert: alerts, organization: string): Alert {
    return {
      id: alert.id,
      type: alert.type,
      createdAt: alert.created_at as any,
      channelId: alert.alert_channel_id,
      organizationId: organization,
      projectId: alert.project_id,
      targetId: alert.target_id,
    };
  }

  const shared = {
    async getUserBySuperTokenId(
      { superTokensUserId }: { superTokensUserId: string },
      connection: Connection,
    ) {
      const user = await connection.maybeOne<
        users & {
          provider: string | null;
        }
      >(sql`
        SELECT
          u.*,
          stu.third_party_id as provider
        FROM
          users as u
        LEFT JOIN supertokens_thirdparty_users as stu ON (stu.user_id = u.supertoken_user_id)
        WHERE
          u.supertoken_user_id = ${superTokensUserId}
        LIMIT 1
      `);

      if (user) {
        return transformUser(user);
      }

      return null;
    },
    async createUser(
      {
        superTokensUserId,
        email,
        fullName,
        displayName,
        externalAuthUserId,
        oidcIntegrationId,
      }: {
        superTokensUserId: string;
        email: string;
        fullName: string;
        displayName: string;
        externalAuthUserId: string | null;
        oidcIntegrationId: string | null;
      },
      connection: Connection,
    ) {
      const user = await connection.one<users>(
        sql`
          INSERT INTO users
            ("email", "supertoken_user_id", "full_name", "display_name", "external_auth_user_id", "oidc_integration_id")
          VALUES
            (${email}, ${superTokensUserId}, ${fullName}, ${displayName}, ${externalAuthUserId}, ${oidcIntegrationId})
          RETURNING *
        `,
      );

      const provider = await connection.maybeOneFirst<string>(sql`
        SELECT third_party_id FROM supertokens_thirdparty_users WHERE user_id = ${superTokensUserId} LIMIT 1
      `);

      return transformUser({
        ...user,
        provider,
      });
    },
    async getOrganization(userId: string, connection: Connection) {
      const org = await connection.maybeOne<Slonik<organizations>>(
        sql`SELECT * FROM organizations WHERE user_id = ${userId} AND type = ${'PERSONAL'} LIMIT 1`,
      );

      return org ? transformOrganization(org) : null;
    },
    async createOrganization(
      {
        name,
        user,
        cleanId,
        adminScopes,
        viewerScopes,
        reservedNames,
      }: Parameters<Storage['createOrganization']>[0] & {
        reservedNames: string[];
      },
      connection: Connection,
    ) {
      function addRandomHashToId(id: string) {
        return `${id}-${Math.random().toString(16).substring(2, 6)}`;
      }

      async function ensureFreeCleanId(id: string, originalId: string | null): Promise<string> {
        if (reservedNames.includes(id)) {
          return ensureFreeCleanId(addRandomHashToId(id), originalId);
        }

        const orgCleanIdExists = await connection.exists(
          sql`SELECT 1 FROM organizations WHERE clean_id = ${id} LIMIT 1`,
        );

        if (orgCleanIdExists) {
          return ensureFreeCleanId(addRandomHashToId(id), originalId);
        }

        return id;
      }
      const availableCleanId = await ensureFreeCleanId(cleanId, null);

      const org = await connection.one<Slonik<organizations>>(
        sql`
          INSERT INTO organizations
            ("name", "clean_id", "user_id")
          VALUES
            (${name}, ${availableCleanId}, ${user})
          RETURNING *
        `,
      );

      // Create default roles for the organization
      const roles = await connection.query<Pick<organization_member_roles, 'id' | 'name'>>(sql`
        INSERT INTO organization_member_roles
        (
          organization_id,
          name,
          description,
          scopes,
          locked
        )
        VALUES (
          ${org.id},
          'Admin',
          'Full access to all organization resources',
          ${sql.array(adminScopes, 'text')},
          true
        ), (
          ${org.id},
          'Viewer',
          'Read-only access to all organization resources',
          ${sql.array(viewerScopes, 'text')},
          true
        )
        RETURNING id, name
      `);

      const adminRole = roles.rows.find(role => role.name === 'Admin');

      if (!adminRole) {
        throw new Error('Admin role not found');
      }

      // Assign the admin role to the user
      await connection.query<Slonik<organization_member>>(
        sql`
          INSERT INTO organization_member
            ("organization_id", "user_id", "role_id")
          VALUES
            (${org.id}, ${user}, ${adminRole.id})
        `,
      );

      return transformOrganization(org);
    },
    async addOrganizationMemberViaOIDCIntegrationId(
      args: {
        oidcIntegrationId: string;
        userId: string;
      },
      connection: Connection,
    ) {
      const linkedOrganizationId = await connection.maybeOneFirst<string>(sql`
        SELECT
          "linked_organization_id"
        FROM
          "oidc_integrations"
        WHERE
          "id" = ${args.oidcIntegrationId}
      `);

      if (linkedOrganizationId === null) {
        return;
      }

      const viewerRole = await shared.getOrganizationMemberRoleByName(
        { organizationId: linkedOrganizationId, roleName: 'Viewer' },
        connection,
      );
      // TODO: turn it into a default role and let the admin choose the default role
      await connection.query(
        sql`
          INSERT INTO organization_member
            (organization_id, user_id, role_id)
          VALUES
            (${linkedOrganizationId}, ${args.userId}, ${viewerRole.id})
          ON CONFLICT DO NOTHING
          RETURNING *
        `,
      );
    },
    async getOrganizationMemberRoleByName(
      args: {
        organizationId: string;
        roleName: string;
      },
      connection: Connection,
    ) {
      const result = await connection.one(sql`
        SELECT
          id, name, description, scopes, locked, organization_id
        FROM organization_member_roles
        WHERE organization_id = ${args.organizationId} AND name = ${args.roleName}
        LIMIT 1
      `);

      return OrganizationMemberRoleModel.parse(result);
    },
  };

  function buildUserData(input: {
    superTokensUserId: string;
    email: string;
    externalAuthUserId: string | null;
    oidcIntegrationId: string | null;
  }) {
    const displayName = input.email.split('@')[0].slice(0, 25).padEnd(2, '1');
    const fullName = input.email.split('@')[0].slice(0, 25).padEnd(2, '1');

    return {
      superTokensUserId: input.superTokensUserId,
      email: input.email,
      displayName,
      fullName,
      externalAuthUserId: input.externalAuthUserId,
      oidcIntegrationId: input.oidcIntegrationId,
    };
  }

  const storage: Storage = {
    destroy() {
      return pool.end();
    },
    async isReady() {
      try {
        await pool.exists(sql`SELECT 1`);
        return true;
      } catch {
        return false;
      }
    },
    async ensureUserExists({
      superTokensUserId,
      externalAuthUserId,
      email,
      oidcIntegration,
    }: {
      superTokensUserId: string;
      externalAuthUserId?: string | null;
      email: string;
      oidcIntegration: null | {
        id: string;
      };
    }) {
      return pool.transaction(async t => {
        let action: 'created' | 'no_action' = 'no_action';
        let internalUser = await shared.getUserBySuperTokenId({ superTokensUserId }, t);

        if (!internalUser) {
          internalUser = await shared.createUser(
            buildUserData({
              superTokensUserId,
              email,
              externalAuthUserId: externalAuthUserId ?? null,
              oidcIntegrationId: oidcIntegration?.id ?? null,
            }),
            t,
          );
          action = 'created';
        }

        if (oidcIntegration !== null) {
          // Add user to OIDC linked integration
          await shared.addOrganizationMemberViaOIDCIntegrationId(
            {
              oidcIntegrationId: oidcIntegration.id,
              userId: internalUser.id,
              // TODO: pass a default role here
            },
            t,
          );
        }

        return action;
      });
    },
    async getUserBySuperTokenId({ superTokensUserId }) {
      return shared.getUserBySuperTokenId({ superTokensUserId }, pool);
    },
    getUserById: batch(async input => {
      const userIds = input.map(i => i.id);
      const users = await pool.any<
        users & {
          provider: string | null;
        }
      >(sql`
        SELECT
          u.*, stu.third_party_id as provider
        FROM
          "users" as u
        LEFT JOIN
          supertokens_thirdparty_users as stu ON (stu.user_id = u.supertoken_user_id)
        WHERE
          u.id = ANY(${sql.array(userIds, 'uuid')})
      `);

      const mappings = new Map<
        string,
        users & {
          provider: string | null;
        }
      >();
      for (const user of users) {
        mappings.set(user.id, user);
      }

      return userIds.map(id => {
        const user = mappings.get(id) ?? null;
        return Promise.resolve(user ? transformUser(user) : null);
      });
    }),
    async updateUser({ id, displayName, fullName }) {
      const user = await pool.one<users>(sql`
        UPDATE "users"
        SET display_name = ${displayName}, full_name = ${fullName}
        WHERE id = ${id}
        RETURNING *
      `);

      const provider = await pool.maybeOneFirst<string>(sql`
        SELECT third_party_id FROM supertokens_thirdparty_users WHERE user_id = ${user.supertoken_user_id} LIMIT 1
      `);

      return transformUser({
        ...user,
        provider,
      });
    },
    createOrganization(input) {
      return pool.transaction(t => shared.createOrganization(input, t));
    },
    async deleteOrganization({ organization }) {
      const result = await pool.transaction(async t => {
        const tokensResult = await t.query<Pick<tokens, 'token'>>(sql`
          SELECT token FROM tokens WHERE organization_id = ${organization} AND deleted_at IS NULL
        `);

        return {
          organization: await t.one<organizations>(
            sql`
              DELETE FROM organizations
              WHERE id = ${organization}
              RETURNING *
            `,
          ),
          tokens: tokensResult.rows.map(row => row.token),
        };
      });

      return {
        ...transformOrganization(result.organization),
        tokens: result.tokens,
      };
    },
    async createProject({ name, organization, cleanId, type }) {
      return transformProject(
        await pool.one<Slonik<projects>>(
          sql`
            INSERT INTO projects
              ("name", "clean_id", "type", "org_id")
            VALUES
              (${name}, ${cleanId}, ${type}, ${organization})
            RETURNING *
          `,
        ),
      );
    },
    async getOrganizationId({ organization }) {
      // Based on clean_id, resolve id
      const result = await pool.one<Pick<organizations, 'id'>>(
        sql`SELECT id FROM organizations WHERE clean_id = ${organization} LIMIT 1`,
      );

      return result.id;
    },
    getOrganizationOwnerId: batch(async selectors => {
      const organizations = selectors.map(s => s.organization);
      const owners = await pool.query<Slonik<Pick<organizations, 'user_id' | 'id'>>>(
        sql`
        SELECT id, user_id
        FROM organizations
        WHERE id IN (${sql.join(organizations, sql`, `)})`,
      );

      return organizations.map(async organization => {
        const owner = owners.rows.find(row => row.id === organization);

        if (owner) {
          return owner.user_id;
        }

        return null;
      });
    }),
    getOrganizationOwner: batch(async selectors => {
      const organizations = selectors.map(s => s.organization);
      const owners = await pool.query<
        users &
          Pick<organization_member, 'scopes' | 'organization_id' | 'connected_to_zendesk'> &
          MemberRoleColumns & {
            provider: string | null;
          }
      >(
        sql`
        SELECT
          u.*,
          COALESCE(omr.scopes, om.scopes) as scopes,
          om.organization_id,
          om.connected_to_zendesk,
          omr.id as role_id,
          omr.name as role_name,
          omr.locked as role_locked,
          omr.scopes as role_scopes,
          omr.description as role_description,
          stu.third_party_id as provider
        FROM organizations as o
        LEFT JOIN users as u ON (u.id = o.user_id)
        LEFT JOIN organization_member as om ON (om.user_id = u.id AND om.organization_id = o.id)
        LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
        LEFT JOIN supertokens_thirdparty_users as stu ON (stu.user_id = u.supertoken_user_id)
        WHERE o.id IN (${sql.join(organizations, sql`, `)})`,
      );

      return organizations.map(organization => {
        const owner = owners.rows.find(row => row.organization_id === organization);

        if (owner) {
          return Promise.resolve(
            transformMember({
              ...owner,
              is_owner: true,
            }),
          );
        }

        return Promise.reject(new Error(`Owner not found (organization=${organization})`));
      });
    }),
    async countOrganizationMembers({ organization }) {
      const { total } = await pool.one<{ total: number }>(
        sql`SELECT COUNT(*) as total FROM organization_member WHERE organization_id = ${organization}`,
      );

      return total;
    },
    getOrganizationMembers: batch(async selectors => {
      const organizations = selectors.map(s => s.organization);
      const allMembers = await pool.query<
        users &
          Pick<organization_member, 'scopes' | 'organization_id' | 'connected_to_zendesk'> & {
            is_owner: boolean;
          } & MemberRoleColumns & {
            provider: string | null;
          }
      >(
        sql`
        SELECT
          u.*,
          COALESCE(omr.scopes, om.scopes) as scopes,
          om.organization_id,
          om.connected_to_zendesk,
          CASE WHEN o.user_id = om.user_id THEN true ELSE false END AS is_owner,
          omr.id as role_id,
          omr.name as role_name,
          omr.locked as role_locked,
          omr.scopes as role_scopes,
          omr.description as role_description,
          stu.third_party_id as provider
        FROM organization_member as om
        LEFT JOIN organizations as o ON (o.id = om.organization_id)
        LEFT JOIN users as u ON (u.id = om.user_id)
        LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
        LEFT JOIN supertokens_thirdparty_users as stu ON (stu.user_id = u.supertoken_user_id)
        WHERE om.organization_id IN (${sql.join(
          organizations,
          sql`, `,
        )}) ORDER BY u.created_at DESC`,
      );

      return organizations.map(organization => {
        const members = allMembers.rows.filter(row => row.organization_id === organization);

        if (members) {
          return Promise.resolve(members.map(transformMember));
        }

        return Promise.reject(new Error(`Members not found (organization=${organization})`));
      });
    }),
    getOrganizationMember: batch(async selectors => {
      const membersResult = await pool.query<
        users &
          Pick<organization_member, 'organization_id' | 'scopes' | 'connected_to_zendesk'> & {
            is_owner: boolean;
          } & MemberRoleColumns & {
            provider: string | null;
          }
      >(
        sql`
          SELECT
            u.*,
            COALESCE(omr.scopes, om.scopes) as scopes,
            om.organization_id,
            om.connected_to_zendesk,
            CASE WHEN o.user_id = om.user_id THEN true ELSE false END AS is_owner,
            omr.id as role_id,
            omr.name as role_name,
            omr.locked as role_locked,
            omr.scopes as role_scopes,
            omr.description as role_description,
            stu.third_party_id as provider
          FROM organization_member as om
          LEFT JOIN organizations as o ON (o.id = om.organization_id)
          LEFT JOIN users as u ON (u.id = om.user_id)
          LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
          LEFT JOIN supertokens_thirdparty_users as stu ON (stu.user_id = u.supertoken_user_id)
          WHERE (om.organization_id, om.user_id) IN ((${sql.join(
            selectors.map(s => sql`${s.organization}, ${s.user}`),
            sql`), (`,
          )}))
          ORDER BY u.created_at DESC
        `,
      );

      return selectors.map(selector => {
        const member = membersResult.rows.find(
          row => row.organization_id === selector.organization && row.id === selector.user,
        );

        if (member) {
          return Promise.resolve(transformMember(member));
        }

        return Promise.resolve(null);
      });
    }),
    getAdminOrganizationMemberRole({ organizationId }) {
      return shared.getOrganizationMemberRoleByName(
        {
          organizationId,
          roleName: 'Admin',
        },
        pool,
      );
    },
    getViewerOrganizationMemberRole({ organizationId }) {
      return shared.getOrganizationMemberRoleByName(
        {
          organizationId,
          roleName: 'Viewer',
        },
        pool,
      );
    },
    async getOrganizationMemberRoles(selector) {
      const results = await pool.many(sql`
        SELECT
          id, name, description, scopes, locked, organization_id
        FROM organization_member_roles
        WHERE organization_id = ${selector.organizationId}
        ORDER BY array_length(scopes, 1) DESC, name ASC
      `);

      return results.map(role => OrganizationMemberRoleModel.parse(role));
    },
    async getOrganizationMemberRole(selector) {
      const result = await pool.maybeOne<{
        members_count: number;
      }>(sql`
        SELECT
          id, name, description, scopes, locked, organization_id,
          (
            SELECT count(*)
            FROM organization_member
            WHERE role_id = ${selector.roleId} AND organization_id = ${selector.organizationId}
          ) AS members_count
        FROM organization_member_roles
        WHERE organization_id = ${selector.organizationId} AND id = ${selector.roleId}
        LIMIT 1
      `);

      if (!result) {
        return null;
      }

      return {
        ...OrganizationMemberRoleModel.parse(result),
        membersCount: result.members_count,
      };
    },
    hasOrganizationMemberRoleName({ organizationId, roleName, excludeRoleId }) {
      return pool.exists(sql`
        SELECT 1
        FROM organization_member_roles
        WHERE
          organization_id = ${organizationId}
          AND
          name = ${roleName}
          ${excludeRoleId ? sql`AND id != ${excludeRoleId}` : sql``}
        LIMIT 1
      `);
    },
    getOrganizationInvitations: batch(async selectors => {
      const organizations = selectors.map(s => s.organization);
      const allInvitations = await pool.query<
        organization_invitations & {
          role: organization_member_roles;
        }
      >(
        sql`
          SELECT oi.*, to_jsonb(omr.*) as role
          FROM organization_invitations as oi
          LEFT JOIN organization_member_roles as omr ON (omr.organization_id = oi.organization_id AND omr.id = oi.role_id)
          WHERE oi.organization_id IN (${sql.join(
            organizations,
            sql`, `,
          )}) AND oi.expires_at > NOW() ORDER BY oi.created_at DESC
        `,
      );

      return organizations.map(organization => {
        return Promise.resolve(
          allInvitations.rows
            .filter(row => row.organization_id === organization)
            .map(transformOrganizationInvitation) ?? [],
        );
      });
    }),
    async deleteOrganizationMemberRole({ organizationId, roleId }) {
      await pool.transaction(async t => {
        const viewerRoleId = await t.oneFirst(sql`
          SELECT id FROM organization_member_roles
          WHERE organization_id = ${organizationId} AND locked = true AND name = 'Viewer'
          LIMIT 1
        `);

        // move all invitations to the viewer role
        await t.query(sql`
          UPDATE organization_invitations
          SET role_id = ${viewerRoleId}
          WHERE role_id = ${roleId} AND organization_id = ${organizationId}
        `);

        await t.query(sql`
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
    async getMembersWithoutRole({ organizationId }) {
      const result = await pool.query<
        users &
          Pick<organization_member, 'scopes' | 'organization_id' | 'connected_to_zendesk'> & {
            is_owner: boolean;
          } & MemberRoleColumns & {
            provider: string | null;
          }
      >(
        sql`
        SELECT
          u.*,
          COALESCE(omr.scopes, om.scopes) as scopes,
          om.organization_id,
          om.connected_to_zendesk,
          CASE WHEN o.user_id = om.user_id THEN true ELSE false END AS is_owner,
          omr.id as role_id,
          omr.name as role_name,
          omr.locked as role_locked,
          omr.scopes as role_scopes,
          omr.description as role_description,
          stu.third_party_id as provider
        FROM organization_member as om
        LEFT JOIN organizations as o ON (o.id = om.organization_id)
        LEFT JOIN users as u ON (u.id = om.user_id)
        LEFT JOIN organization_member_roles as omr ON (omr.organization_id = o.id AND omr.id = om.role_id)
        LEFT JOIN supertokens_thirdparty_users as stu ON (stu.user_id = u.supertoken_user_id)
        WHERE om.organization_id = ${organizationId} AND om.role_id IS NULL`,
      );

      return result.rows.map(transformMember);
    },
    async getOrganizationMemberAccessPairs(pairs) {
      const results = await pool.query<
        Slonik<Pick<organization_member, 'organization_id' | 'user_id' | 'scopes'>>
      >(
        sql`
          SELECT om.organization_id, om.user_id, COALESCE(omr.scopes, om.scopes) as scopes
          FROM organization_member as om
          LEFT JOIN organization_member_roles as omr ON (omr.organization_id = om.organization_id AND omr.id = om.role_id)
          WHERE (om.organization_id, om.user_id) IN ((${sql.join(
            pairs.map(p => sql`${p.organization}, ${p.user}`),
            sql`), (`,
          )}))
        `,
      );

      return pairs.map(({ organization, user }) => {
        return (results.rows.find(
          row => row.organization_id === organization && row.user_id === user,
        )?.scopes || []) as Member['scopes'];
      });
    },
    async hasOrganizationMemberPairs(pairs) {
      const results = await pool.query<Slonik<organization_member>>(
        sql`
          SELECT organization_id, user_id
          FROM organization_member
          WHERE (organization_id, user_id) IN ((${sql.join(
            pairs.map(p => sql`${p.organization}, ${p.user}`),
            sql`), (`,
          )}))
        `,
      );

      return pairs.map(({ organization, user }) =>
        results.rows.some(row => row.organization_id === organization && row.user_id === user),
      );
    },
    async hasOrganizationProjectMemberPairs(pairs) {
      const results = await pool.query<Slonik<organization_member & { project_id: string }>>(
        sql`
          SELECT om.organization_id, om.user_id, p.id AS project_id
          FROM projects as p
          LEFT JOIN organization_member as om ON (p.org_id = om.organization_id)
          WHERE (om.organization_id, om.user_id, p.id) IN ((${sql.join(
            pairs.map(p => sql`${p.organization}, ${p.user}, ${p.project}`),
            sql`), (`,
          )}))
        `,
      );

      return pairs.map(({ organization, user, project }) =>
        results.rows.some(
          row =>
            row.organization_id === organization &&
            row.project_id === project &&
            row.user_id === user,
        ),
      );
    },
    async updateOrganizationName({ name, cleanId, organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE organizations
          SET name = ${name}, clean_id = ${cleanId}
          WHERE id = ${organization}
          RETURNING *
        `),
      );
    },
    async updateOrganizationPlan({ billingPlan, organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE organizations
          SET plan_name = ${billingPlan}
          WHERE id = ${organization}
          RETURNING *
        `),
      );
    },
    async updateOrganizationRateLimits({ monthlyRateLimit, organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE organizations
          SET limit_operations_monthly = ${monthlyRateLimit.operations}, limit_retention_days = ${monthlyRateLimit.retentionInDays}
          WHERE id = ${organization}
          RETURNING *
        `),
      );
    },
    async createOrganizationInvitation({ organization, email, roleId }) {
      return transformOrganizationInvitation(
        await pool.transaction(async trx => {
          const invitation = await trx.one<organization_invitations>(sql`
          INSERT INTO organization_invitations (organization_id, email, role_id)
          VALUES (${organization}, ${email}, ${roleId})
          RETURNING *
        `);

          const role = await trx.one<organization_member_roles>(sql`
          SELECT * FROM organization_member_roles WHERE id = ${roleId} LIMIT 1
        `);

          return {
            ...invitation,
            role,
          };
        }),
      );
    },
    async deleteOrganizationInvitationByEmail({ organization, email }) {
      const result = await pool.transaction(async trx => {
        const deleted = await trx.maybeOne<organization_invitations>(sql`
        DELETE FROM organization_invitations
        WHERE organization_id = ${organization} AND email = ${email}
        RETURNING *
      `);

        if (!deleted) {
          return null;
        }

        const role = await trx.one<organization_member_roles>(sql`
          SELECT * FROM organization_member_roles WHERE id = ${deleted.role_id} LIMIT 1
        `);

        return {
          ...deleted,
          role,
        };
      });

      if (!result) {
        return null;
      }

      return transformOrganizationInvitation(result);
    },
    async addOrganizationMemberViaInvitationCode({ code, user, organization }) {
      await pool.transaction(async trx => {
        const roleId = await trx.oneFirst<string>(sql`
          DELETE FROM organization_invitations
          WHERE organization_id = ${organization} AND code = ${code}
          RETURNING role_id
        `);

        await trx.query(
          sql`
            INSERT INTO organization_member
              (organization_id, user_id, role_id)
            VALUES
              (${organization}, ${user}, ${roleId})
          `,
        );
      });
    },
    async createOrganizationTransferRequest({ organization, user }) {
      const code = Math.random().toString(16).substring(2, 12);

      await pool.query<Slonik<Pick<organizations, 'ownership_transfer_code'>>>(
        sql`
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
    async getOrganizationTransferRequest({ code, user, organization }) {
      return pool.maybeOne<{
        code: string;
      }>(sql`
        SELECT ownership_transfer_code as code FROM organizations
        WHERE
          ownership_transfer_user_id = ${user}
          AND id = ${organization}
          AND ownership_transfer_code = ${code}
          AND ownership_transfer_expires_at > NOW()
      `);
    },
    async answerOrganizationTransferRequest({ organization, user, code, accept }) {
      await pool.transaction(async tsx => {
        const owner = await tsx.maybeOne<Slonik<Pick<organizations, 'user_id'>>>(sql`
          SELECT user_id
          FROM organizations
          WHERE
            id = ${organization}
            AND ownership_transfer_user_id = ${user}
            AND ownership_transfer_code = ${code}
            AND ownership_transfer_expires_at > NOW()
        `);

        if (!owner) {
          throw new Error('No organization transfer request found');
        }

        if (!accept) {
          // NULL out the transfer request
          await tsx.query(sql`
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

        const adminRole = await shared.getOrganizationMemberRoleByName(
          {
            organizationId: organization,
            roleName: 'Admin',
          },
          tsx,
        );

        // set admin role
        await tsx.query(sql`
          UPDATE organization_member
          SET role_id = ${adminRole.id}
          WHERE organization_id = ${organization} AND user_id = ${user}
        `);

        // NULL out the transfer request
        // assign the new owner
        await tsx.query(sql`
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
    async deleteOrganizationMember({ user, organization }) {
      await pool.query<organization_member>(
        sql`
          DELETE FROM organization_member
          WHERE organization_id = ${organization} AND user_id = ${user}
        `,
      );
    },
    async updateOrganizationMemberAccess({ user, organization, scopes }) {
      await pool.query<Slonik<organization_member>>(
        sql`
          UPDATE organization_member
          SET scopes = ${sql.array(scopes, 'text')}
          WHERE organization_id = ${organization} AND user_id = ${user} AND role_id IS NULL
        `,
      );
    },
    async createOrganizationMemberRole({ organizationId, name, scopes, description }) {
      const role = await pool.one(
        sql`
          INSERT INTO organization_member_roles
          (organization_id, name, description, scopes)
          VALUES
          (${organizationId}, ${name}, ${description}, ${sql.array(scopes, 'text')})
          RETURNING *
        `,
      );

      return OrganizationMemberRoleModel.parse(role);
    },
    async updateOrganizationMemberRole({ organizationId, roleId, name, scopes, description }) {
      const role = await pool.one(
        sql`
          UPDATE organization_member_roles
          SET
            name = ${name},
            description = ${description},
            scopes = ${sql.array(scopes, 'text')}
          WHERE organization_id = ${organizationId} AND id = ${roleId}
          RETURNING *
        `,
      );

      return OrganizationMemberRoleModel.parse(role);
    },
    async assignOrganizationMemberRole({ userId, organizationId, roleId }) {
      await pool.query(
        sql`
          UPDATE organization_member
          SET role_id = ${roleId}
          WHERE organization_id = ${organizationId} AND user_id = ${userId}
        `,
      );
    },
    async assignOrganizationMemberRoleToMany({ userIds, organizationId, roleId }) {
      await pool.query(
        sql`
          UPDATE organization_member
          SET role_id = ${roleId}
          WHERE organization_id = ${organizationId} AND user_id = ANY(${sql.array(userIds, 'uuid')})
        `,
      );
    },
    async getProjectId({ project, organization }) {
      // Based on project's clean_id and organization's clean_id, resolve the actual uuid of the project
      const result = await pool.one<Pick<projects, 'id'>>(
        sql`SELECT p.id as id
        FROM projects as p
        LEFT JOIN organizations as org ON (p.org_id = org.id)
        WHERE p.clean_id = ${project} AND org.clean_id = ${organization} AND p.type != 'CUSTOM' LIMIT 1`,
      );

      return result.id;
    },
    async getTargetId({ project, target, organization, useIds }) {
      if (useIds) {
        const result = await pool.one<Pick<targets, 'id'>>(
          sql`
          SELECT t.id FROM targets as t
          LEFT JOIN projects AS p ON (p.id = t.project_id)
          LEFT JOIN organizations AS o ON (o.id = p.org_id)
          WHERE t.clean_id = ${target} AND p.id = ${project} AND o.id = ${organization} AND p.type != 'CUSTOM'
          LIMIT 1`,
        );

        return result.id;
      }

      // Based on clean_id, resolve id
      const result = await pool.one<Pick<targets, 'id'>>(
        sql`
          SELECT t.id FROM targets as t
          LEFT JOIN projects AS p ON (p.id = t.project_id)
          LEFT JOIN organizations AS o ON (o.id = p.org_id)
          WHERE t.clean_id = ${target} AND p.clean_id = ${project} AND o.clean_id = ${organization} AND p.type != 'CUSTOM'
          LIMIT 1`,
      );

      return result.id;
    },
    async getOrganization({ organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(
          sql`SELECT * FROM organizations WHERE id = ${organization} LIMIT 1`,
        ),
      );
    },
    async getMyOrganization({ user }) {
      const org = await pool.maybeOne<Slonik<organizations>>(
        sql`SELECT * FROM organizations WHERE user_id = ${user} AND type = ${'PERSONAL'} LIMIT 1`,
      );

      return org ? transformOrganization(org) : null;
    },
    async getOrganizations({ user }) {
      const results = await pool.query<Slonik<organizations>>(
        sql`
          SELECT o.*
          FROM organizations as o
          LEFT JOIN organization_member as om ON (om.organization_id = o.id)
          WHERE om.user_id = ${user}
          ORDER BY o.created_at DESC
        `,
      );

      return results.rows.map(transformOrganization);
    },
    async getOrganizationByInviteCode({ inviteCode }) {
      const result = await pool.maybeOne<Slonik<organizations>>(
        sql`
          SELECT o.* FROM organizations as o
          LEFT JOIN organization_invitations as i ON (i.organization_id = o.id)
          WHERE i.code = ${inviteCode} AND i.expires_at > NOW()
          GROUP BY o.id
          LIMIT 1
        `,
      );

      if (result) {
        return transformOrganization(result);
      }

      return null;
    },
    async getOrganizationByCleanId({ cleanId }) {
      const result = await pool.maybeOne<Slonik<organizations>>(
        sql`SELECT * FROM organizations WHERE clean_id = ${cleanId} LIMIT 1`,
      );

      if (!result) {
        return null;
      }

      return transformOrganization(result);
    },
    async getOrganizationByGitHubInstallationId({ installationId }) {
      const result = await pool.maybeOne<Slonik<organizations>>(
        sql`
          SELECT * FROM organizations
          WHERE github_app_installation_id = ${installationId}
          LIMIT 1
        `,
      );

      if (result) {
        return transformOrganization(result);
      }

      return null;
    },
    async getProject({ project }) {
      return transformProject(
        await pool.one<Slonik<projects>>(
          sql`SELECT * FROM projects WHERE id = ${project} AND type != 'CUSTOM' LIMIT 1`,
        ),
      );
    },
    async getProjectByCleanId({ cleanId, organization }) {
      const result = await pool.maybeOne<Slonik<projects>>(
        sql`SELECT * FROM projects WHERE clean_id = ${cleanId} AND org_id = ${organization} AND type != 'CUSTOM' LIMIT 1`,
      );

      if (!result) {
        return null;
      }

      return transformProject(result);
    },
    async getProjects({ organization }) {
      const result = await pool.query<Slonik<projects>>(
        sql`SELECT * FROM projects WHERE org_id = ${organization} AND type != 'CUSTOM' ORDER BY created_at DESC`,
      );

      return result.rows.map(transformProject);
    },
    async updateProjectName({ name, cleanId, organization, project }) {
      return transformProject(
        await pool.one<Slonik<projects>>(sql`
          UPDATE projects
          SET name = ${name}, clean_id = ${cleanId}
          WHERE id = ${project} AND org_id = ${organization}
          RETURNING *
        `),
      );
    },
    async updateNativeSchemaComposition({ organization, project, enabled }) {
      return transformProject(
        await pool.transaction(async t => {
          await t.one(sql`
            UPDATE organizations
            SET
              feature_flags = ${sql.jsonb({
                compareToPreviousComposableVersion: true,
              })}
            WHERE id = ${organization}
            RETURNING id
          `);

          return await t.one<projects>(sql`
            UPDATE projects
            SET
              native_federation = ${enabled}
            WHERE id = ${project}
            RETURNING *
          `);
        }),
      );
    },
    async enableExternalSchemaComposition({ project, endpoint, encryptedSecret }) {
      return transformProject(
        await pool.one<Slonik<projects>>(sql`
          UPDATE projects
          SET
            external_composition_enabled = TRUE,
            external_composition_endpoint = ${endpoint},
            external_composition_secret = ${encryptedSecret}
          WHERE id = ${project}
          RETURNING *
        `),
      );
    },
    async disableExternalSchemaComposition({ project }) {
      return transformProject(
        await pool.one<Slonik<projects>>(sql`
          UPDATE projects
          SET
            external_composition_enabled = FALSE,
            external_composition_endpoint = NULL,
            external_composition_secret = NULL
          WHERE id = ${project}
          RETURNING *
        `),
      );
    },
    async enableProjectNameInGithubCheck({ project }) {
      return transformProject(
        await pool.one<projects>(sql`
          UPDATE projects
          SET github_check_with_project_name = true
          WHERE id = ${project}
          RETURNING *
        `),
      );
    },
    async updateProjectRegistryModel({ project, model }) {
      const isLegacyModel = model === 'LEGACY';

      return transformProject(
        await pool.one<projects>(sql`
          UPDATE projects
          SET legacy_registry_model = ${isLegacyModel}
          WHERE id = ${project}
          RETURNING *
        `),
      );
    },

    async deleteProject({ organization, project }) {
      const result = await pool.transaction(async t => {
        const tokensResult = await t.query<Pick<tokens, 'token'>>(sql`
          SELECT token FROM tokens WHERE project_id = ${project} AND deleted_at IS NULL
        `);

        return {
          project: await t.one<projects>(
            sql`
              DELETE FROM projects
              WHERE id = ${project} AND org_id = ${organization}
              RETURNING *
            `,
          ),
          tokens: tokensResult.rows.map(row => row.token),
        };
      });

      return {
        ...transformProject(result.project),
        tokens: result.tokens,
      };
    },
    async createTarget({ organization, project, name, cleanId }) {
      const result = await pool.maybeOne<unknown>(sql`
        INSERT INTO targets
          (name, clean_id, project_id)
        VALUES
          (${name}, ${cleanId}, ${project})
        RETURNING
          ${targetSQLFields}
      `);

      return {
        ...TargetModel.parse(result),
        orgId: organization,
      };
    },
    async updateTargetName({ organization, project, target, name, cleanId }) {
      const result = await pool.one<Record<string, unknown>>(sql`
        UPDATE
          targets
        SET
          "name" = ${name},
          "clean_id" = ${cleanId}
        WHERE
          "id" = ${target}
          AND "project_id" = ${project}
        RETURNING
          ${targetSQLFields}
      `);

      return {
        ...TargetModel.parse(result),
        orgId: organization,
      };
    },
    async deleteTarget({ organization, target }) {
      const result = await pool.transaction(async t => {
        const tokensResult = await t.query<Pick<tokens, 'token'>>(sql`
          SELECT token FROM tokens WHERE target_id = ${target} AND deleted_at IS NULL
        `);

        const targetResult = await t.one<targets>(
          sql`
            DELETE FROM targets
            WHERE id = ${target}
            RETURNING
              ${targetSQLFields}
          `,
        );

        await t.query(sql`DELETE FROM schema_versions WHERE target_id = ${target}`);

        return {
          target: targetResult,
          tokens: tokensResult.rows.map(row => row.token),
        };
      });

      return {
        ...TargetModel.parse(result.target),
        orgId: organization,
        tokens: result.tokens,
      };
    },
    getTarget: batch(
      async (
        selectors: Array<{
          organization: string;
          project: string;
          target: string;
        }>,
      ) => {
        const uniqueSelectorsMap = new Map<string, (typeof selectors)[0]>();

        for (const selector of selectors) {
          const key = JSON.stringify({
            organization: selector.organization,
            project: selector.project,
            target: selector.target,
          });

          uniqueSelectorsMap.set(key, selector);
        }

        const uniqueSelectors = Array.from(uniqueSelectorsMap.values());

        const rows = await pool
          .many<unknown>(
            sql`
              SELECT
                ${targetSQLFields}
              FROM
                targets
              WHERE
                (id, project_id) IN (
                  (${sql.join(
                    uniqueSelectors.map(s => sql`${s.target}, ${s.project}`),
                    sql`), (`,
                  )})
                )
            `,
          )
          .then(rows => rows.map(row => TargetModel.parse(row)));

        return selectors.map(selector => {
          const row = rows.find(
            row => row.id === selector.target && row.projectId === selector.project,
          );

          if (!row) {
            return Promise.reject(
              new Error(
                `Target not found (target=${selector.target}, project=${selector.project})`,
              ),
            );
          }

          return Promise.resolve({
            ...row,
            orgId: selector.organization,
          });
        });
      },
    ),
    async getTargetByCleanId({ organization, project, cleanId }) {
      const result = await pool.maybeOne<unknown>(sql`
        SELECT
          ${targetSQLFields}
        FROM
          targets
        WHERE
          clean_id = ${cleanId}
          AND project_id = ${project}
        LIMIT 1
      `);

      if (!result) {
        return null;
      }

      return {
        ...TargetModel.parse(result),
        orgId: organization,
      };
    },
    async getTargets({ organization, project }) {
      const results = await pool.query<unknown>(sql`
        SELECT
          ${targetSQLFields}
        FROM
          targets
        WHERE
          project_id = ${project}
        ORDER BY
          created_at DESC
      `);

      return results.rows.map(r => ({
        ...TargetModel.parse(r),
        orgId: organization,
      }));
    },
    async getTargetIdsOfOrganization({ organization }) {
      const results = await pool.query<Slonik<Pick<targets, 'id'>>>(
        sql`
          SELECT t.id as id FROM targets as t
          LEFT JOIN projects as p ON (p.id = t.project_id)
          WHERE p.org_id = ${organization}
          GROUP BY t.id
        `,
      );

      return results.rows.map(r => r.id);
    },
    async getTargetIdsOfProject({ project }) {
      const results = await pool.query<Slonik<Pick<targets, 'id'>>>(
        sql`
          SELECT id FROM targets WHERE project_id = ${project}
        `,
      );

      return results.rows.map(r => r.id);
    },
    async getTargetSettings({ target, project }) {
      const row = await pool.one<
        Pick<
          targets,
          | 'validation_enabled'
          | 'validation_percentage'
          | 'validation_period'
          | 'validation_excluded_clients'
        > & {
          targets: target_validation['destination_target_id'][];
        }
      >(sql`
        SELECT
          t.validation_enabled,
          t.validation_percentage,
          t.validation_period,
          t.validation_excluded_clients,
          array_agg(tv.destination_target_id) as targets
        FROM targets AS t
        LEFT JOIN target_validation AS tv ON (tv.target_id = t.id)
        WHERE t.id = ${target} AND t.project_id = ${project}
        GROUP BY t.id
        LIMIT 1
      `);

      return transformTargetSettings(row);
    },
    async setTargetValidation({ target, project, enabled }) {
      return transformTargetSettings(
        await pool.transaction(async trx => {
          const targetValidationRowExists = await trx.exists(sql`
            SELECT 1 FROM target_validation WHERE target_id = ${target}
          `);

          if (!targetValidationRowExists) {
            await trx.query(sql`
              INSERT INTO target_validation (target_id, destination_target_id) VALUES (${target}, ${target})
            `);
          }

          return trx.one<
            Pick<
              targets,
              | 'validation_enabled'
              | 'validation_percentage'
              | 'validation_period'
              | 'validation_excluded_clients'
            > & {
              targets: target_validation['destination_target_id'][];
            }
          >(sql`
          UPDATE targets as t
          SET validation_enabled = ${enabled}
          FROM
            (
              SELECT
                  it.id,
                  array_agg(tv.destination_target_id) as targets
              FROM targets AS it
              LEFT JOIN target_validation AS tv ON (tv.target_id = it.id)
              WHERE it.id = ${target} AND it.project_id = ${project}
              GROUP BY it.id
              LIMIT 1
            ) ret
          WHERE t.id = ret.id
          RETURNING ret.id, t.validation_enabled, t.validation_percentage, t.validation_period, t.validation_excluded_clients, ret.targets
        `);
        }),
      ).validation;
    },
    async updateTargetValidationSettings({
      target,
      project,
      percentage,
      period,
      targets,
      excludedClients,
    }) {
      return transformTargetSettings(
        await pool.transaction(async trx => {
          await trx.query(sql`
            DELETE
            FROM target_validation
            WHERE destination_target_id NOT IN (${sql.join(targets, sql`, `)})
              AND target_id = ${target}
          `);

          await trx.query(sql`
            INSERT INTO target_validation
              (target_id, destination_target_id)
            VALUES
            (
              ${sql.join(
                targets.map(dest => sql.join([target, dest], sql`, `)),
                sql`), (`,
              )}
            )
            ON CONFLICT (target_id, destination_target_id) DO NOTHING
          `);

          return trx.one(sql`
            UPDATE targets as t
            SET validation_percentage = ${percentage}, validation_period = ${period}, validation_excluded_clients = ${sql.array(
              excludedClients,
              'text',
            )}
            FROM (
              SELECT
                it.id,
                array_agg(tv.destination_target_id) as targets
              FROM targets AS it
              LEFT JOIN target_validation AS tv ON (tv.target_id = it.id)
              WHERE it.id = ${target} AND it.project_id = ${project}
              GROUP BY it.id
              LIMIT 1
            ) ret
            WHERE t.id = ret.id
            RETURNING t.id, t.validation_enabled, t.validation_percentage, t.validation_period, t.validation_excluded_clients, ret.targets;
          `);
        }),
      ).validation;
    },

    async countSchemaVersionsOfProject({ project, period }) {
      if (period) {
        const result = await pool.maybeOne<{ total: number }>(sql`
          SELECT COUNT(*) as total FROM schema_versions as sv
          LEFT JOIN targets as t ON (t.id = sv.target_id)
          WHERE 
            t.project_id = ${project}
            AND sv.created_at >= ${period.from.toISOString()}
            AND sv.created_at < ${period.to.toISOString()}
        `);
        return result?.total ?? 0;
      }

      const result = await pool.maybeOne<{ total: number }>(sql`
        SELECT COUNT(*) as total FROM schema_versions as sv
        LEFT JOIN targets as t ON (t.id = sv.target_id)
        WHERE t.project_id = ${project}
      `);

      return result?.total ?? 0;
    },
    async countSchemaVersionsOfTarget({ target, period }) {
      if (period) {
        const result = await pool.maybeOne<{ total: number }>(sql`
          SELECT COUNT(*) as total FROM schema_versions
          WHERE 
            target_id = ${target}
            AND created_at >= ${period.from.toISOString()}
            AND created_at < ${period.to.toISOString()}
        `);
        return result?.total ?? 0;
      }

      const result = await pool.maybeOne<{ total: number }>(sql`
        SELECT COUNT(*) as total FROM schema_versions WHERE target_id = ${target}
      `);

      return result?.total ?? 0;
    },

    async hasSchema({ target }) {
      return pool.exists(
        sql`
          SELECT 1 FROM schema_versions as v WHERE v.target_id = ${target} LIMIT 1
        `,
      );
    },
    async getMaybeLatestValidVersion({ target }) {
      const version = await pool.maybeOne<unknown>(
        sql`
          SELECT
            ${schemaVersionSQLFields(sql`sv.`)}
          FROM schema_versions as sv
          WHERE sv.target_id = ${target} AND sv.is_composable IS TRUE
          ORDER BY sv.created_at DESC
          LIMIT 1
        `,
      );

      if (!version) {
        return null;
      }

      return SchemaVersionModel.parse(version);
    },
    async getLatestValidVersion({ target }) {
      const version = await pool.maybeOne<unknown>(
        sql`
          SELECT
            ${schemaVersionSQLFields(sql`sv.`)}
          FROM schema_versions as sv
          WHERE sv.target_id = ${target} AND sv.is_composable IS TRUE
          ORDER BY sv.created_at DESC
          LIMIT 1
        `,
      );

      return SchemaVersionModel.parse(version);
    },
    async getLatestVersion({ project, target }) {
      const version = await pool.maybeOne<unknown>(
        sql`
          SELECT
            ${schemaVersionSQLFields(sql`sv.`)}
          FROM schema_versions as sv
          LEFT JOIN targets as t ON (t.id = sv.target_id)
          WHERE sv.target_id = ${target} AND t.project_id = ${project}
          ORDER BY sv.created_at DESC
          LIMIT 1
        `,
      );

      return SchemaVersionModel.parse(version);
    },

    async getMaybeLatestVersion({ project, target }) {
      const version = await pool.maybeOne<unknown>(
        sql`
          SELECT
            ${schemaVersionSQLFields(sql`sv.`)}
          FROM schema_versions as sv
          LEFT JOIN targets as t ON (t.id = sv.target_id)
          WHERE sv.target_id = ${target} AND t.project_id = ${project}
          ORDER BY sv.created_at DESC
          LIMIT 1
        `,
      );

      if (!version) {
        return null;
      }

      return SchemaVersionModel.parse(version);
    },
    async getVersionBeforeVersionId(args) {
      const version = await pool.maybeOne<unknown>(
        sql`
          SELECT
            ${schemaVersionSQLFields()}
          FROM "schema_versions"
          WHERE
            "target_id" = ${args.target}
            AND (
              (
                "created_at" = ${args.beforeVersionCreatedAt}
                AND "id" < ${args.beforeVersionId}
              )
              OR "created_at" < ${args.beforeVersionCreatedAt}
            )
            ${args.onlyComposable ? sql`AND "is_composable" = TRUE` : sql``}
          ORDER BY
            "created_at" DESC
          LIMIT 1
        `,
      );

      if (!version) {
        return null;
      }

      return SchemaVersionModel.parse(version);
    },
    async getLatestSchemas({ project, target, onlyComposable }) {
      const latest = await pool.maybeOne<Pick<schema_versions, 'id' | 'is_composable'>>(sql`
        SELECT sv.id, sv.is_composable
        FROM schema_versions as sv
        LEFT JOIN targets as t ON (t.id = sv.target_id)
        LEFT JOIN schema_log as sl ON (sl.id = sv.action_id)
        WHERE t.id = ${target} AND t.project_id = ${project} AND ${
          onlyComposable ? sql`sv.is_composable IS TRUE` : true
        }
        ORDER BY sv.created_at DESC
        LIMIT 1
      `);

      if (!latest) {
        return null;
      }

      const schemas = await storage.getSchemasOfVersion({
        version: latest.id,
        includeMetadata: true,
      });

      return {
        version: latest.id,
        valid: latest.is_composable,
        schemas,
      };
    },
    async getSchemaByNameOfVersion(args) {
      const result = await pool.maybeOne<
        Pick<
          OverrideProp<schema_log, 'action', 'PUSH'>,
          | 'id'
          | 'commit'
          | 'action'
          | 'author'
          | 'sdl'
          | 'created_at'
          | 'project_id'
          | 'service_name'
          | 'service_url'
          | 'target_id'
          | 'metadata'
        > &
          Pick<projects, 'type'>
      >(
        sql`
          SELECT
            sl.id,
            sl.commit,
            sl.author,
            sl.action,
            sl.sdl,
            sl.created_at,
            sl.project_id,
            lower(sl.service_name) as service_name,
            sl.service_url,
            sl.target_id,
            p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${args.versionId}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
            AND lower(sl.service_name) = lower(${args.serviceName})
          ORDER BY
            sl.created_at DESC
        `,
      );

      if (!result) {
        return null;
      }

      return transformSchema(result);
    },
    async getSchemasOfVersion({ version, includeMetadata = false }) {
      const result = await pool.query<
        Pick<
          OverrideProp<schema_log, 'action', 'PUSH'>,
          | 'id'
          | 'commit'
          | 'action'
          | 'author'
          | 'sdl'
          | 'created_at'
          | 'project_id'
          | 'service_name'
          | 'service_url'
          | 'target_id'
          | 'metadata'
        > &
          Pick<projects, 'type'>
      >(
        sql`
          SELECT
            sl.id,
            sl.commit,
            sl.author,
            sl.action,
            sl.sdl,
            sl.created_at,
            sl.project_id,
            lower(sl.service_name) as service_name,
            sl.service_url,
            ${includeMetadata ? sql`sl.metadata,` : sql``}
            sl.target_id,
            p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${version}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
          ORDER BY
            sl.created_at DESC
        `,
      );

      return result.rows.map(transformSchema);
    },
    async getSchemasOfPreviousVersion({ version, target, onlyComposable }) {
      const results = await pool.query<
        OverrideProp<schema_log, 'action', 'PUSH'> &
          Pick<projects, 'type'> &
          Pick<schema_version_to_log, 'version_id'>
      >(
        sql`
          SELECT sl.*, lower(sl.service_name) as service_name, p.type, svl.version_id as version_id
          FROM schema_version_to_log as svl
          LEFT JOIN schema_log as sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE svl.version_id = (
            SELECT sv.id FROM schema_versions as sv WHERE sv.created_at < (
              SELECT svi.created_at FROM schema_versions as svi WHERE svi.id = ${version}
            ) AND sv.target_id = ${target} AND ${
              onlyComposable ? sql`sv.is_composable IS TRUE` : true
            } ORDER BY sv.created_at DESC LIMIT 1
          ) AND sl.action = 'PUSH'
          ORDER BY sl.created_at DESC
        `,
      );

      if (results.rowCount === 0) {
        return {
          schemas: [],
        };
      }

      return {
        schemas: results.rows.map(transformSchema),
        id: results.rows[0].version_id,
      };
    },

    async getServiceSchemaOfVersion(args) {
      const result = await pool.maybeOne<
        Pick<
          OverrideProp<schema_log, 'action', 'PUSH'>,
          | 'id'
          | 'commit'
          | 'action'
          | 'author'
          | 'sdl'
          | 'created_at'
          | 'project_id'
          | 'service_name'
          | 'service_url'
          | 'target_id'
          | 'metadata'
        > &
          Pick<projects, 'type'>
      >(sql`
        SELECT
            sl.id,
            sl.commit,
            sl.author,
            sl.action,
            sl.sdl,
            sl.created_at,
            sl.project_id,
            lower(sl.service_name) as service_name,
            sl.service_url,
            sl.target_id,
            p.type
          FROM schema_version_to_log AS svl
          LEFT JOIN schema_log AS sl ON (sl.id = svl.action_id)
          LEFT JOIN projects as p ON (p.id = sl.project_id)
          WHERE
            svl.version_id = ${args.schemaVersionId}
            AND sl.action = 'PUSH'
            AND p.type != 'CUSTOM'
            AND lower(sl.service_name) = lower(${args.serviceName})
      `);

      if (!result) {
        return null;
      }

      return transformSchema(result);
    },

    async getMatchingServiceSchemaOfVersions(versions) {
      const after = await pool.one<{
        sdl: string;
        service_name: string;
      }>(sql`
        SELECT sl.service_name, sl.sdl
        FROM schema_versions as sv
        LEFT JOIN schema_log as sl ON sv.action_id = sl.id
        WHERE sv.id = ${versions.after} AND service_name IS NOT NULL
      `);

      // It's an initial version, so we just need to fetch a single version
      if (!versions.before) {
        return { serviceName: after.service_name, after: after.sdl, before: null };
      }

      const before = await pool.maybeOne<{
        sdl: string | null;
      }>(sql`
        SELECT sl.sdl
        FROM schema_version_to_log as svtl
        LEFT JOIN schema_log as sl ON svtl.action_id = sl.id
        WHERE svtl.version_id = ${versions.before} AND sl.service_name = ${after.service_name}
      `);

      return { serviceName: after.service_name, after: after.sdl, before: before?.sdl ?? null };
    },

    async getVersion({ project, target, version }) {
      const result = await pool.one(sql`
        SELECT 
          ${schemaVersionSQLFields(sql`sv.`)}
        FROM schema_versions as sv
        LEFT JOIN schema_log as sl ON (sl.id = sv.action_id)
        LEFT JOIN targets as t ON (t.id = sv.target_id)
        WHERE
          sv.target_id = ${target}
          AND t.project_id = ${project}
          AND sv.id = ${version}
        LIMIT 1
      `);

      return SchemaVersionModel.parse(result);
    },
    async getPaginatedSchemaVersionsForTargetId(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      const query = sql`
        SELECT 
          ${schemaVersionSQLFields()}
        FROM
          "schema_versions"
        WHERE
          "target_id" = ${args.targetId}
          ${
            cursor
              ? sql`
                AND (
                  (
                    "created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "created_at" < ${cursor.createdAt}
                )
              `
              : sql``
          }
        ORDER BY
          "created_at" DESC
          , "id" DESC
        LIMIT ${limit + 1}
      `;

      const result = await pool.any<unknown>(query);

      let edges = result.map(row => {
        const node = SchemaVersionModel.parse(row);

        return {
          node,
          get cursor() {
            return encodeCreatedAtAndUUIDIdBasedCursor(node);
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
    async deleteSchema(args) {
      return pool.transaction(async trx => {
        // fetch the latest version
        const latestVersion = await trx.one<Pick<schema_versions, 'id' | 'base_schema'>>(
          sql`
          SELECT sv.id, sv.base_schema
          FROM schema_versions as sv
          WHERE sv.target_id = ${args.target}
          ORDER BY sv.created_at DESC
          LIMIT 1
        `,
        );

        // create a new action
        const deleteActionResult = await trx.one<schema_log>(sql`
          INSERT INTO schema_log
            (
              author,
              commit,
              service_name,
              project_id,
              target_id,
              action
            )
          VALUES
            (
              ${'system'}::text,
              ${'system'}::text,
              lower(${args.serviceName}::text),
              ${args.project},
              ${args.target},
              'DELETE'
            )
          RETURNING *
        `);

        // creates a new version
        const newVersion = await insertSchemaVersion(trx, {
          isComposable: args.composable,
          targetId: args.target,
          actionId: deleteActionResult.id,
          baseSchema: latestVersion.base_schema,
          previousSchemaVersion: latestVersion.id,
          diffSchemaVersionId: args.diffSchemaVersionId,
          compositeSchemaSDL: args.compositeSchemaSDL,
          supergraphSDL: args.supergraphSDL,
          schemaCompositionErrors: args.schemaCompositionErrors,
          // Deleting a schema is done via CLI and not associated to a commit or a pull request.
          github: null,
          tags: args.tags,
          hasContractCompositionErrors:
            args.contracts?.some(c => c.schemaCompositionErrors != null) ?? false,
        });

        // Move all the schema_version_to_log entries of the previous version to the new version
        await trx.query(sql`
          INSERT INTO schema_version_to_log
            (version_id, action_id)
          SELECT ${newVersion.id}::uuid as version_id, svl.action_id
          FROM schema_version_to_log svl
          LEFT JOIN schema_log sl ON (sl.id = svl.action_id)
          WHERE svl.version_id = ${latestVersion.id} AND sl.action = 'PUSH' AND lower(sl.service_name) != lower(${args.serviceName})
        `);

        await trx.query(sql`
          INSERT INTO schema_version_to_log
            (version_id, action_id)
          VALUES
            (${newVersion.id}, ${deleteActionResult.id})
        `);

        if (args.changes != null) {
          await insertSchemaVersionChanges(trx, {
            versionId: newVersion.id,
            changes: args.changes,
          });
        }

        for (const contract of args.contracts ?? []) {
          const schemaVersionContractId = await insertSchemaVersionContract(trx, {
            schemaVersionId: newVersion.id,
            contractId: contract.contractId,
            contractName: contract.contractName,
            schemaCompositionErrors: contract.schemaCompositionErrors,
            compositeSchemaSDL: contract.compositeSchemaSDL,
            supergraphSDL: contract.supergraphSDL,
          });
          await insertSchemaVersionContractChanges(trx, {
            schemaVersionContractId,
            changes: contract.changes,
          });
        }

        await args.actionFn();

        return {
          kind: 'composite',
          id: deleteActionResult.id,
          versionId: deleteActionResult.id,
          date: deleteActionResult.created_at as any,
          service_name: deleteActionResult.service_name!,
          target: deleteActionResult.target_id,
          action: 'DELETE',
        };
      });
    },
    async createVersion(input) {
      const url = input.url ?? null;
      const service = input.service ?? null;

      const output = await pool.transaction(async trx => {
        const log = await pool.one<Pick<schema_log, 'id'>>(sql`
          INSERT INTO schema_log
            (
              author,
              service_name,
              service_url,
              commit,
              sdl,
              project_id,
              target_id,
              metadata,
              action
            )
          VALUES
            (
              ${input.author},
              lower(${service}::text),
              ${url}::text,
              ${input.commit}::text,
              ${input.schema}::text,
              ${input.project},
              ${input.target},
              ${input.metadata},
              'PUSH'
            )
          RETURNING id
        `);

        // creates a new version
        const version = await insertSchemaVersion(trx, {
          isComposable: input.valid,
          targetId: input.target,
          actionId: log.id,
          baseSchema: input.base_schema,
          previousSchemaVersion: input.previousSchemaVersion,
          diffSchemaVersionId: input.diffSchemaVersionId,
          compositeSchemaSDL: input.compositeSchemaSDL,
          supergraphSDL: input.supergraphSDL,
          schemaCompositionErrors: input.schemaCompositionErrors,
          github: input.github,
          tags: input.tags,
          hasContractCompositionErrors:
            input.contracts?.some(c => c.schemaCompositionErrors != null) ?? false,
        });

        await Promise.all(
          input.logIds.concat(log.id).map(async lid => {
            await trx.query(sql`
              INSERT INTO schema_version_to_log
                (version_id, action_id)
              VALUES
              (${version.id}, ${lid})
            `);
          }),
        );

        await insertSchemaVersionChanges(trx, {
          versionId: version.id,
          changes: input.changes,
        });

        for (const contract of input.contracts ?? []) {
          const schemaVersionContractId = await insertSchemaVersionContract(trx, {
            schemaVersionId: version.id,
            contractId: contract.contractId,
            contractName: contract.contractName,
            schemaCompositionErrors: contract.schemaCompositionErrors,
            compositeSchemaSDL: contract.compositeSchemaSDL,
            supergraphSDL: contract.supergraphSDL,
          });
          await insertSchemaVersionContractChanges(trx, {
            schemaVersionContractId,
            changes: contract.changes,
          });
        }

        await input.actionFn();

        return {
          version,
          log,
        };
      });

      return output.version;
    },

    async getSchemaChangesForVersion(args) {
      // TODO: should this be paginated?
      const changes = await pool.query<unknown>(sql`
        SELECT
          "change_type" as "type",
          "meta",
          "severity_level" as "severityLevel",
          "is_safe_based_on_usage" as "isSafeBasedOnUsage"
        FROM
          "schema_version_changes"
        WHERE
          "schema_version_id" = ${args.versionId}
      `);

      if (changes.rows.length === 0) {
        return null;
      }

      return changes.rows.map(row => HiveSchemaChangeModel.parse(row));
    },

    async updateVersionStatus({ version, valid }) {
      return SchemaVersionModel.parse(
        await pool.maybeOne<unknown>(sql`
          UPDATE
            schema_versions
          SET
            is_composable = ${valid}
          WHERE
            id = ${version}
          RETURNING
          ${schemaVersionSQLFields()}
        `),
      );
    },

    getSchemaLog: batch(async selectors => {
      const rows = await pool.many<schema_log & Pick<projects, 'type'>>(
        sql`
            SELECT sl.*, lower(sl.service_name) as service_name, p.type
            FROM schema_log as sl
            LEFT JOIN projects as p ON (p.id = sl.project_id)
            WHERE (sl.id, sl.target_id) IN ((${sql.join(
              selectors.map(s => sql`${s.commit}, ${s.target}`),
              sql`), (`,
            )}))
        `,
      );
      const schemas = rows.map(transformSchemaLog);

      return selectors.map(selector => {
        const schema = schemas.find(
          row => row.id === selector.commit && row.target === selector.target,
        );

        if (schema) {
          return Promise.resolve(schema);
        }

        return Promise.reject(
          new Error(`Schema log not found (commit=${selector.commit}, target=${selector.target})`),
        );
      });
    }),
    async createActivity({ organization, project, target, user, type, meta }) {
      const { identifiers, values } = objectToParams<Omit<activities, 'id' | 'created_at'>>({
        activity_metadata: meta,
        activity_type: type,
        organization_id: organization,
        project_id: project ?? null,
        target_id: target ?? null,
        user_id: user ?? null,
      });

      await pool.query<Slonik<activities>>(
        sql`INSERT INTO activities (${identifiers}) VALUES (${values}) RETURNING *;`,
      );
    },
    async getActivities(selector) {
      let query: TaggedTemplateLiteralInvocation;
      if ('target' in selector) {
        query = sql`
          SELECT
            jsonb_agg(a.*) as activity,
            jsonb_agg(
              json_build_object(
                'id', t."id",
                'cleanId', t."clean_id",
                'name', t."name",
                'projectId', t."project_id",
                'graphqlEndpointUrl', t."graphql_endpoint_url"
              )
            ) as target,
            jsonb_agg(p.*) as project,
            jsonb_agg(o.*) as organization,
            jsonb_agg(u.*) as user
          FROM activities as a
          LEFT JOIN targets as t ON (t.id = a.target_id)
          LEFT JOIN projects as p ON (p.id = a.project_id)
          LEFT JOIN organizations as o ON (o.id = a.organization_id)
          LEFT JOIN users as u ON (u.id = a.user_id)
          WHERE
            a.target_id = ${selector.target}
            AND a.project_id = ${selector.project}
            AND a.organization_id = ${selector.organization}
            AND p.type != 'CUSTOM'
          GROUP BY a.created_at
          ORDER BY a.created_at DESC LIMIT ${selector.limit}
        `;
      } else if ('project' in selector) {
        query = sql`
          SELECT
            jsonb_agg(a.*) as activity,
            jsonb_agg(
              json_build_object(
                'id', t."id",
                'cleanId', t."clean_id",
                'name', t."name",
                'projectId', t."project_id",
                'graphqlEndpointUrl', t."graphql_endpoint_url"
              )
            ) as target,
            jsonb_agg(p.*) as project,
            jsonb_agg(o.*) as organization,
            jsonb_agg(u.*) as user
          FROM activities as a
          LEFT JOIN targets as t ON (t.id = a.target_id)
          LEFT JOIN projects as p ON (p.id = a.project_id)
          LEFT JOIN organizations as o ON (o.id = a.organization_id)
          LEFT JOIN users as u ON (u.id = a.user_id)
          WHERE
            a.project_id = ${selector.project}
            AND a.organization_id = ${selector.organization}
            AND p.type != 'CUSTOM'
          GROUP BY a.created_at
          ORDER BY a.created_at DESC LIMIT ${selector.limit}
        `;
      } else {
        query = sql`
          SELECT
            jsonb_agg(a.*) as activity,
            jsonb_agg(
              json_build_object(
                'id', t."id",
                'cleanId', t."clean_id",
                'name', t."name",
                'projectId', t."project_id",
                'graphqlEndpointUrl', t."graphql_endpoint_url"
              )
            ) as target,
            jsonb_agg(p.*) as project,
            jsonb_agg(o.*) as organization,
            jsonb_agg(u.*) as user
          FROM activities as a
          LEFT JOIN targets as t ON (t.id = a.target_id)
          LEFT JOIN projects as p ON (p.id = a.project_id)
          LEFT JOIN organizations as o ON (o.id = a.organization_id)
          LEFT JOIN users as u ON (u.id = a.user_id)
          WHERE a.organization_id = ${selector.organization} AND p.type != 'CUSTOM'
          GROUP BY a.created_at
          ORDER BY a.created_at DESC LIMIT ${selector.limit}
        `;
      }

      const result = await pool.query<
        Slonik<{
          activity: [activities];
          target: [Record<string, unknown>];
          project: [projects];
          organization: [organizations];
          user: [users];
        }>
      >(query);

      return result.rows.map(transformActivity);
    },
    async addSlackIntegration({ organization, token }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE organizations
          SET slack_token = ${token}
          WHERE id = ${organization}
        `,
      );
    },
    async deleteSlackIntegration({ organization }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE organizations
          SET slack_token = NULL
          WHERE id = ${organization}
        `,
      );
    },
    async getSlackIntegrationToken({ organization }) {
      const result = await pool.maybeOne<Pick<organizations, 'slack_token'>>(
        sql`
          SELECT slack_token
          FROM organizations
          WHERE id = ${organization}
        `,
      );

      return result?.slack_token;
    },
    async addGitHubIntegration({ organization, installationId }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE organizations
          SET github_app_installation_id = ${installationId}
          WHERE id = ${organization}
        `,
      );
    },
    async deleteGitHubIntegration({ organization }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE organizations
          SET github_app_installation_id = NULL
          WHERE id = ${organization}
        `,
      );
      await pool.query<Slonik<projects>>(
        sql`
          UPDATE projects
          SET git_repository = NULL
          WHERE org_id = ${organization}
        `,
      );
    },
    async getGitHubIntegrationInstallationId({ organization }) {
      const result = await pool.maybeOne<Pick<organizations, 'github_app_installation_id'>>(
        sql`
          SELECT github_app_installation_id
          FROM organizations
          WHERE id = ${organization}
        `,
      );

      return result?.github_app_installation_id;
    },
    async addAlertChannel({ project, name, type, slack, webhook }) {
      return transformAlertChannel(
        await pool.one<Slonik<alert_channels>>(
          sql`
            INSERT INTO alert_channels
              ("name", "type", "project_id", "slack_channel", "webhook_endpoint")
            VALUES
              (${name}, ${type}, ${project}, ${slack?.channel ?? null}, ${
                webhook?.endpoint ?? null
              })
            RETURNING *
          `,
        ),
      );
    },
    async deleteAlertChannels({ project, channels }) {
      const result = await pool.query<Slonik<alert_channels>>(
        sql`
          DELETE FROM alert_channels
          WHERE
            project_id = ${project} AND
            id IN (${sql.join(channels, sql`, `)})
          RETURNING *
        `,
      );

      return result.rows.map(transformAlertChannel);
    },
    async getAlertChannels({ project }) {
      const result = await pool.query<Slonik<alert_channels>>(
        sql`SELECT * FROM alert_channels WHERE project_id = ${project} ORDER BY created_at DESC`,
      );

      return result.rows.map(transformAlertChannel);
    },

    async addAlert({ organization, project, target, channel, type }) {
      return transformAlert(
        await pool.one<Slonik<alerts>>(
          sql`
            INSERT INTO alerts
              ("type", "alert_channel_id", "target_id", "project_id")
            VALUES
              (${type}, ${channel}, ${target}, ${project})
            RETURNING *
          `,
        ),
        organization,
      );
    },
    async deleteAlerts({ organization, project, alerts }) {
      const result = await pool.query<Slonik<alerts>>(
        sql`
          DELETE FROM alerts
          WHERE
            project_id = ${project} AND
            id IN (${sql.join(alerts, sql`, `)})
          RETURNING *
        `,
      );

      return result.rows.map(row => transformAlert(row, organization));
    },
    async getAlerts({ organization, project }) {
      const result = await pool.query<Slonik<alerts>>(
        sql`SELECT * FROM alerts WHERE project_id = ${project} ORDER BY created_at DESC`,
      );

      return result.rows.map(row => transformAlert(row, organization));
    },
    async adminGetOrganizationsTargetPairs() {
      const results = await pool.query<
        Slonik<{
          organization: string;
          target: string;
        }>
      >(
        sql`
          SELECT
            o.id as organization,
            t.id as target
          FROM targets AS t
          LEFT JOIN projects AS p ON (p.id = t.project_id)
          LEFT JOIN organizations AS o ON (o.id = p.org_id)
        `,
      );
      return results.rows;
    },
    async getGetOrganizationsAndTargetPairsWithLimitInfo() {
      const results = await pool.query<
        Slonik<{
          organization: string;
          org_name: string;
          org_clean_id: string;
          org_plan_name: string;
          owner_email: string;
          target: string;
          limit_operations_monthly: number;
          limit_retention_days: number;
        }>
      >(
        sql`
          SELECT
            o.id as organization,
            o.clean_id as org_clean_id,
            o.name as org_name,
            o.limit_operations_monthly,
            o.limit_retention_days,
            o.plan_name as org_plan_name,
            t.id as target,
            u.email as owner_email
          FROM targets AS t
          LEFT JOIN projects AS p ON (p.id = t.project_id)
          LEFT JOIN organizations AS o ON (o.id = p.org_id)
          LEFT JOIN users AS u ON (u.id = o.user_id)
        `,
      );
      return results.rows;
    },
    async adminGetStats(period: { from: Date; to: Date }) {
      // count schema versions by organization
      const versionsResult = pool.query<
        Slonik<
          Pick<organizations, 'id'> & {
            total: number;
          }
        >
      >(sql`
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
        GROUP by o.id
      `);

      // count users by organization
      const usersResult = pool.query<
        Slonik<
          Pick<organizations, 'id'> & {
            total: number;
          }
        >
      >(sql`
        SELECT
          COUNT(*) as total,
          o.id
        FROM organization_member AS om
        LEFT JOIN organizations AS o ON (o.id = om.organization_id)
        GROUP by o.id
      `);

      // count projects by organization
      const projectsResult = pool.query<
        Slonik<
          Pick<organizations, 'id'> & {
            total: number;
          }
        >
      >(sql`
        SELECT
          COUNT(*) as total,
          o.id
        FROM projects AS p
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        GROUP by o.id
      `);

      // count targets by organization
      const targetsResult = pool.query<
        Slonik<
          Pick<organizations, 'id'> & {
            total: number;
          }
        >
      >(sql`
        SELECT
          COUNT(*) as total,
          o.id
        FROM targets AS t
        LEFT JOIN projects AS p ON (p.id = t.project_id)
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        GROUP by o.id
      `);

      // get organizations data
      const organizationsResult = pool.query<Slonik<organizations>>(sql`
        SELECT * FROM organizations
      `);

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

      for (const organization of organizations.rows) {
        rows.push({
          organization: transformOrganization(organization),
          versions: extractTotal(versions.rows, organization.id),
          users: extractTotal(users.rows, organization.id),
          projects: extractTotal(projects.rows, organization.id),
          targets: extractTotal(targets.rows, organization.id),
          persistedOperations: 0,
          period,
        });
      }

      return rows;
    },
    async getBaseSchema({ project, target }) {
      const data = await pool.maybeOne<Record<string, string>>(
        sql`SELECT base_schema FROM targets WHERE id=${target} AND project_id=${project}`,
      );
      return data?.base_schema ?? null;
    },
    async updateBaseSchema({ project, target }, base) {
      if (base) {
        await pool.query(
          sql`UPDATE targets SET base_schema = ${base} WHERE id = ${target} AND project_id = ${project}`,
        );
      } else {
        await pool.query(
          sql`UPDATE targets SET base_schema = null WHERE id = ${target} AND project_id = ${project}`,
        );
      }
    },
    async getBillingParticipants() {
      const results = await pool.query<Slonik<organizations_billing>>(
        sql`SELECT * FROM organizations_billing`,
      );

      return results.rows.map(transformOrganizationBilling);
    },
    async getOrganizationBilling(selector) {
      const results = await pool.query<Slonik<organizations_billing>>(
        sql`SELECT * FROM organizations_billing WHERE organization_id = ${selector.organization}`,
      );

      const mapped = results.rows.map(transformOrganizationBilling);

      return mapped[0] || null;
    },
    async deleteOrganizationBilling(selector) {
      await pool.query<Slonik<organizations_billing>>(
        sql`DELETE FROM organizations_billing
        WHERE organization_id = ${selector.organization}`,
      );
    },
    async createOrganizationBilling({
      billingEmailAddress,
      organizationId,
      externalBillingReference,
    }) {
      return transformOrganizationBilling(
        await pool.one<Slonik<organizations_billing>>(
          sql`
            INSERT INTO organizations_billing
              ("organization_id", "external_billing_reference_id", "billing_email_address")
            VALUES
              (${organizationId}, ${externalBillingReference}, ${billingEmailAddress || null})
            RETURNING *
          `,
        ),
      );
    },
    async completeGetStartedStep({ organization, step }) {
      await update(
        pool,
        'organizations',
        {
          [organizationGetStartedMapping[step]]: true,
        },
        {
          id: organization,
        },
      );
    },

    async getOIDCIntegrationById({ oidcIntegrationId: integrationId }) {
      const result = await pool.maybeOne<unknown>(sql`
        SELECT
          "id"
          , "linked_organization_id"
          , "client_id"
          , "client_secret"
          , "oauth_api_url"
          , "token_endpoint"
          , "userinfo_endpoint"
          , "authorization_endpoint"
        FROM
          "oidc_integrations"
        WHERE
          "id" = ${integrationId}
        LIMIT 1
      `);

      if (result === null) {
        return null;
      }

      return decodeOktaIntegrationRecord(result);
    },

    async getOIDCIntegrationForOrganization({ organizationId }) {
      const result = await pool.maybeOne<unknown>(sql`
        SELECT
          "id"
          , "linked_organization_id"
          , "client_id"
          , "client_secret"
          , "oauth_api_url"
          , "token_endpoint"
          , "userinfo_endpoint"
          , "authorization_endpoint"
        FROM
          "oidc_integrations"
        WHERE
          "linked_organization_id" = ${organizationId}
        LIMIT 1
      `);

      if (result === null) {
        return null;
      }

      return decodeOktaIntegrationRecord(result);
    },

    async createOIDCIntegrationForOrganization(args) {
      try {
        const result = await pool.maybeOne<unknown>(sql`
          INSERT INTO "oidc_integrations" (
            "linked_organization_id",
            "client_id",
            "client_secret",
            "token_endpoint",
            "userinfo_endpoint",
            "authorization_endpoint"
          )
          VALUES (
            ${args.organizationId},
            ${args.clientId},
            ${args.encryptedClientSecret},
            ${args.tokenEndpoint},
            ${args.userinfoEndpoint},
            ${args.authorizationEndpoint}
          )
          RETURNING
            "id"
            , "linked_organization_id"
            , "client_id"
            , "client_secret"
            , "oauth_api_url"
            , "token_endpoint"
            , "userinfo_endpoint"
            , "authorization_endpoint"
        `);

        return {
          type: 'ok',
          oidcIntegration: decodeOktaIntegrationRecord(result),
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
      const result = await pool.maybeOne<unknown>(sql`
        UPDATE "oidc_integrations"
        SET
          "client_id" = ${args.clientId ?? sql`"client_id"`}
          , "client_secret" = ${args.encryptedClientSecret ?? sql`"client_secret"`}
          , "token_endpoint" = ${
            args.tokenEndpoint ??
            /** update existing columns to the old legacy values if not yet stored */
            sql`COALESCE("token_endpoint", CONCAT("oauth_api_url", "/token"))`
          }
          , "userinfo_endpoint" = ${
            args.userinfoEndpoint ??
            /** update existing columns to the old legacy values if not yet stored */
            sql`COALESCE("userinfo_endpoint", CONCAT("oauth_api_url", "/userinfo"))`
          }
          , "authorization_endpoint" = ${
            args.authorizationEndpoint ??
            /** update existing columns to the old legacy values if not yet stored */
            sql`COALESCE("authorization_endpoint", CONCAT("oauth_api_url", "/authorize"))`
          }
          , "oauth_api_url" = NULL
        WHERE
          "id" = ${args.oidcIntegrationId}
        RETURNING
          "id"
          , "linked_organization_id"
          , "client_id"
          , "client_secret"
          , "oauth_api_url"
          , "token_endpoint"
          , "userinfo_endpoint"
          , "authorization_endpoint"
      `);

      return decodeOktaIntegrationRecord(result);
    },

    async deleteOIDCIntegration(args) {
      await pool.query<unknown>(sql`
        DELETE FROM "oidc_integrations"
        WHERE
          "id" = ${args.oidcIntegrationId}
      `);
    },

    async createCDNAccessToken(args) {
      const result = await pool.maybeOne(sql`
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
          "id"
          , "target_id"
          , "s3_key"
          , "first_characters"
          , "last_characters"
          , "alias"
          , to_json("created_at") as "created_at"
      `);

      if (result === null) {
        return null;
      }

      return decodeCDNAccessTokenRecord(result);
    },

    async getCDNAccessTokenById(args) {
      const result = await pool.maybeOne(sql`
        SELECT 
          "id"
          , "target_id"
          , "s3_key"
          , "first_characters"
          , "last_characters"
          , "alias"
          , to_json("created_at") as "created_at"
        FROM
          "cdn_access_tokens"
        WHERE
          "id" = ${args.cdnAccessTokenId}
      `);

      if (result == null) {
        return null;
      }
      return decodeCDNAccessTokenRecord(result);
    },

    async deleteCDNAccessToken(args) {
      const result = await pool.maybeOne(sql`
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

      const result = await pool.any(sql`
        SELECT
          "id"
          , "target_id"
          , "s3_key"
          , "first_characters"
          , "last_characters"
          , "alias"
          , to_json("created_at") as "created_at"
        FROM
          "cdn_access_tokens"
        WHERE
          "target_id" = ${args.targetId}
          ${
            cursor
              ? sql`
                AND (
                  (
                    "cdn_access_tokens"."created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "cdn_access_tokens"."created_at" < ${cursor.createdAt}
                )
              `
              : sql``
          }
        ORDER BY
          "target_id" ASC
          , "cdn_access_tokens"."created_at" DESC
          , "id" DESC
        LIMIT ${limit + 1}
      `);

      let items = result.map(row => {
        const node = decodeCDNAccessTokenRecord(row);

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

    async setSchemaPolicyForOrganization(input): Promise<SchemaPolicy> {
      const result = await pool.one<schema_policy_config>(sql`
        INSERT INTO "schema_policy_config"
        ("resource_type", "resource_id", "config", "allow_overriding")
          VALUES ('ORGANIZATION', ${input.organizationId}, ${sql.jsonb(input.policy)}, ${
            input.allowOverrides
          })
        ON CONFLICT
          (resource_type, resource_id)
        DO UPDATE
          SET "config" = ${sql.jsonb(input.policy)},
              "allow_overriding" = ${input.allowOverrides},
              "updated_at" = now() 
        RETURNING *;
      `);

      return transformSchemaPolicy(result);
    },
    async setSchemaPolicyForProject(input): Promise<SchemaPolicy> {
      const result = await pool.one<schema_policy_config>(sql`
      INSERT INTO "schema_policy_config"
      ("resource_type", "resource_id", "config")
        VALUES ('PROJECT', ${input.projectId}, ${sql.jsonb(input.policy)})
      ON CONFLICT
        (resource_type, resource_id)
      DO UPDATE
        SET "config" = ${sql.jsonb(input.policy)},
            "updated_at" = now() 
      RETURNING *;
    `);

      return transformSchemaPolicy(result);
    },
    async findInheritedPolicies(selector): Promise<SchemaPolicy[]> {
      const { organization, project } = selector;

      const result = await pool.any<schema_policy_config>(sql`
        SELECT *
        FROM
          "schema_policy_config"
        WHERE
          ("resource_type" = 'ORGANIZATION' AND "resource_id" = ${organization})
          OR ("resource_type" = 'PROJECT' AND "resource_id" = ${project});
      `);

      return result.map(transformSchemaPolicy);
    },
    async getSchemaPolicyForOrganization(organizationId: string): Promise<SchemaPolicy | null> {
      const result = await pool.maybeOne<schema_policy_config>(sql`
        SELECT *
        FROM
          "schema_policy_config"
        WHERE
          "resource_type" = 'ORGANIZATION'
          AND "resource_id" = ${organizationId};
      `);

      return result ? transformSchemaPolicy(result) : null;
    },
    async getSchemaPolicyForProject(projectId: string): Promise<SchemaPolicy | null> {
      const result = await pool.maybeOne<schema_policy_config>(sql`
      SELECT *
      FROM
        "schema_policy_config"
      WHERE
        "resource_type" = 'PROJECT'
        AND "resource_id" = ${projectId};
    `);

      return result ? transformSchemaPolicy(result) : null;
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

      const result = await pool.any(sql`
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
              ? sql`
                AND (
                  (
                    "created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "created_at" < ${cursor.createdAt}
                )
              `
              : sql``
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
      const result = await pool.maybeOne(sql`
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
      const result = await pool.maybeOneFirst(sql`
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

      return zod.string().parse(result);
    },

    async updateDocumentCollection(args) {
      const result = await pool.maybeOne(sql`
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

      const result = await pool.any(sql`
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
              ? sql`
                AND (
                  (
                    "created_at" = ${cursor.createdAt}
                    AND "id" < ${cursor.id}
                  )
                  OR "created_at" < ${cursor.createdAt}
                )
              `
              : sql``
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
      const result = await pool.one(sql`
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
      const result = await pool.maybeOneFirst(sql`
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

      return zod.string().parse(result);
    },

    async getDocumentCollectionDocument(args) {
      const result = await pool.maybeOne(sql`
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
      const result = await pool.maybeOne(sql`
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
      const result = await pool.maybeOne(sql`
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
      const result = await pool.transaction(async trx => {
        const sdlStoreInserts: Array<Promise<unknown>> = [];

        function insertSdl(hash: string, sdl: string) {
          sdlStoreInserts.push(
            trx.query<unknown>(sql`
              INSERT INTO "sdl_store" (id, sdl)
              VALUES (${hash}, ${sdl})
              ON CONFLICT (id) DO NOTHING;
            `),
          );
        }

        insertSdl(args.schemaSDLHash, args.schemaSDL);

        if (args.compositeSchemaSDLHash) {
          insertSdl(args.compositeSchemaSDLHash, args.compositeSchemaSDL);
        }

        if (args.supergraphSDLHash) {
          if (!args.supergraphSDL) {
            throw new Error('supergraphSDLHash provided without supergraphSDL');
          }

          insertSdl(args.supergraphSDLHash, args.supergraphSDL);
        }

        if (args.contracts?.length) {
          for (const contract of args.contracts) {
            if (contract.supergraphSchemaSdl && contract.supergraphSchemaSdlHash) {
              insertSdl(contract.supergraphSchemaSdlHash, contract.supergraphSchemaSdl);
            }

            if (contract.compositeSchemaSdl && contract.compositeSchemaSdlHash) {
              insertSdl(contract.compositeSchemaSdlHash, contract.compositeSchemaSdl);
            }
          }
        }

        await Promise.all(sdlStoreInserts);

        const schemaCheck = await trx.one<{ id: string }>(sql`
          INSERT INTO "schema_checks" (
              "schema_sdl_store_id"
            , "service_name"
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
          )
          VALUES (
              ${args.schemaSDLHash}
            , ${args.serviceName}
            , ${jsonify(args.meta)}
            , ${args.targetId}
            , ${args.schemaVersionId}
            , ${args.isSuccess}
            , ${jsonify(args.schemaCompositionErrors)}
            , ${jsonify(args.breakingSchemaChanges?.map(toSerializableSchemaChange))}
            , ${jsonify(args.safeSchemaChanges?.map(toSerializableSchemaChange))}
            , ${jsonify(args.schemaPolicyWarnings?.map(w => SchemaPolicyWarningModel.parse(w)))}
            , ${jsonify(args.schemaPolicyErrors?.map(w => SchemaPolicyWarningModel.parse(w)))}
            , ${args.compositeSchemaSDLHash}
            , ${args.supergraphSDLHash}
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
          )
          RETURNING
            "id"
        `);

        if (args.contracts?.length) {
          for (const contract of args.contracts) {
            await trx.query(sql`
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
              )
              VALUES (
                ${schemaCheck.id}
                , ${contract.comparedContractVersionId}
                , ${contract.isSuccess}
                , ${contract.contractId}
                , ${contract.compositeSchemaSdlHash}
                , ${contract.supergraphSchemaSdlHash}
                , ${jsonify(contract.schemaCompositionErrors)}
                , ${jsonify(contract.breakingSchemaChanges?.map(toSerializableSchemaChange))}
                , ${jsonify(contract.safeSchemaChanges?.map(toSerializableSchemaChange))}
              )
            `);
          }
        }

        return schemaCheck;
      });

      const check = await this.findSchemaCheck({
        schemaCheckId: result.id,
      });

      if (!check) {
        throw new Error('Failed to fetch newly created schema check');
      }

      return check;
    },
    async findSchemaCheck(args) {
      const result = await pool.maybeOne<unknown>(sql`
        SELECT
          ${schemaCheckSQLFields}
        FROM
          "schema_checks" as c
        LEFT JOIN "sdl_store" as s_schema            ON s_schema."id" = c."schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_composite_schema  ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_supergraph        ON s_supergraph."id" = c."supergraph_sdl_store_id"
        WHERE
          c."id" = ${args.schemaCheckId}
      `);

      if (result == null) {
        return null;
      }

      return SchemaCheckModel.parse(result);
    },
    async approveFailedSchemaCheck(args) {
      const schemaCheck = await this.findSchemaCheck({
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
      };

      if (schemaCheck.contextId !== null && !!schemaCheck.breakingSchemaChanges) {
        // Try to approve and claim all the breaking schema changes for this context
        await pool.query(sql`
          INSERT INTO "schema_change_approvals" (
            "target_id"
            , "context_id"
            , "schema_change_id"
            , "schema_change"
          )
          SELECT * FROM ${sql.unnest(
            schemaCheck.breakingSchemaChanges.map(change => [
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
        updateResult = await pool.maybeOne<{
          id: string;
        }>(sql`
          UPDATE
            "schema_checks"
          SET
            "is_success" = true
            , "is_manually_approved" = true
            , "manual_approval_user_id" = ${args.userId}
            , "breaking_schema_changes" = (
              SELECT json_agg(
                CASE
                  WHEN COALESCE(jsonb_typeof("change"->'approvalMetadata'), 'null') = 'null'
                    THEN jsonb_set("change", '{approvalMetadata}', ${sql.jsonb(approvalMetadata)})
                  ELSE "change"
                END
              )
              FROM jsonb_array_elements("breaking_schema_changes") AS "change"
            )
          WHERE
            "id" = ${args.schemaCheckId}
            AND "is_success" = false
            AND "schema_composition_errors" IS NULL
          RETURNING 
            "id"
        `);
      } else if (didUpdateContractChecks) {
        updateResult = await pool.maybeOne<{
          id: string;
        }>(sql`
          UPDATE
            "schema_checks"
          SET
            "is_success" = true
            , "is_manually_approved" = true
            , "manual_approval_user_id" = ${args.userId}
          WHERE
            "id" = ${args.schemaCheckId}
            AND "is_success" = false
            AND "schema_composition_errors" IS NULL
          RETURNING 
            "id"
        `);
      }

      if (updateResult == null) {
        return null;
      }

      const result = await pool.maybeOne<unknown>(sql`
        SELECT
          ${schemaCheckSQLFields}
        FROM
          "schema_checks" as c
        LEFT JOIN "sdl_store" as s_schema            ON s_schema."id" = c."schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_composite_schema  ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_supergraph        ON s_supergraph."id" = c."supergraph_sdl_store_id"
        WHERE
          c."id" = ${updateResult.id}
      `);

      return SchemaCheckModel.parse(result);
    },
    async getApprovedSchemaChangesForContextId(args) {
      const result = await pool.anyFirst<unknown>(sql`
        SELECT
          "schema_change"
        FROM
          "schema_change_approvals"
        WHERE
          "target_id" = ${args.targetId}
          AND "context_id" = ${args.contextId}
      `);

      return result.map(record => HiveSchemaChangeModel.parse(record));
    },
    async getPaginatedSchemaChecksForTarget(args) {
      let cursor: null | {
        createdAt: string;
        id: string;
      } = null;

      const limit = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;

      const { failed, changed } = args.filters ?? {};

      if (args.cursor) {
        cursor = decodeCreatedAtAndUUIDIdBasedCursor(args.cursor);
      }

      const result = await pool.any<unknown>(sql`
        SELECT
          ${schemaCheckSQLFields}
        FROM
          "schema_checks" as c
        LEFT JOIN "sdl_store" as s_schema            ON s_schema."id" = c."schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_composite_schema  ON s_composite_schema."id" = c."composite_schema_sdl_store_id"
        LEFT JOIN "sdl_store" as s_supergraph        ON s_supergraph."id" = c."supergraph_sdl_store_id"
        WHERE
          c."target_id" = ${args.targetId}
          ${
            cursor
              ? sql`
                AND (
                  (
                    c."created_at" = ${cursor.createdAt}
                    AND c."id" < ${cursor.id}
                  )
                  OR c."created_at" < ${cursor.createdAt}
                )
              `
              : sql``
          }
          ${
            failed
              ? sql`
                AND (
                  "is_success" = false
                )
              `
              : sql``
          }
          ${
            changed
              ? sql`
                AND (
                  jsonb_typeof("safe_schema_changes") = 'array'
                  OR jsonb_typeof("breaking_schema_changes") = 'array'
                  OR "has_contract_schema_changes" = true
                )
              `
              : sql``
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

    async getTargetBreadcrumbForTargetId(args) {
      const result = await pool.maybeOne<unknown>(sql`
        SELECT
          o."clean_id" AS "organization",
          p."clean_id" AS "project",
          t."clean_id" AS "target"
        FROM
          "targets" t
          INNER JOIN "projects" p ON t."project_id" = p."id"
          INNER JOIN "organizations" o ON p."org_id" = o."id"
        WHERE
          t."id" = ${args.targetId}
      `);

      if (result === null) {
        return null;
      }

      return TargetBreadcrumbModel.parse(result);
    },

    async getOrganizationUser(args) {
      const result = await pool.maybeOne<
        users & {
          provider: string | null;
        }
      >(sql`
        SELECT
          "u".*, "stu"."third_party_id" as provider
        FROM "organization_member" as "om"
          LEFT JOIN "organizations" as "o" ON ("o"."id" = "om"."organization_id")
          LEFT JOIN "users" as "u" ON ("u"."id" = "om"."user_id")
          LEFT JOIN "supertokens_thirdparty_users" as "stu" ON ("stu"."user_id" = "u"."supertoken_user_id")
        WHERE
          "u"."id" = ${args.userId}
          AND "o"."id" = ${args.organizationId}
      `);

      if (result === null) {
        return null;
      }

      return transformUser(result);
    },

    async updateTargetGraphQLEndpointUrl(args) {
      const result = await pool.maybeOne<unknown>(sql`
        UPDATE
          "targets"
        SET
          "graphql_endpoint_url" = ${args.graphqlEndpointUrl}
        WHERE
          "id" = ${args.targetId}
        RETURNING
          ${targetSQLFields}
      `);

      if (result === null) {
        return null;
      }

      return {
        ...TargetModel.parse(result),
        orgId: args.organizationId,
      };
    },

    async purgeExpiredSchemaChecks(args) {
      const SchemaCheckModel = zod.object({
        schemaCheckIds: zod.array(zod.string()),
        sdlStoreIds: zod.array(zod.string()),
        contextIds: zod.array(zod.string()),
        targetIds: zod.array(zod.string()),
        contractIds: zod.array(zod.string()),
      });
      return await pool.transaction(async pool => {
        const date = args.expiresAt.toISOString();
        const rawData = await pool.maybeOne<unknown>(sql`
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

        await pool.any<unknown>(sql`
          DELETE
          FROM "schema_checks"
          WHERE
            "id" = ANY(${sql.array(data.schemaCheckIds, 'uuid')})
        `);

        if (data.sdlStoreIds.length) {
          deletedSdlStoreCount = await pool.oneFirst<number>(sql`
            WITH "deleted" AS (
              DELETE
              FROM
                "sdl_store"
              WHERE
                "id" = ANY(
                  ${sql.array(data.sdlStoreIds, 'text')}
                )
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM
                    "schema_checks"
                  WHERE
                    "schema_checks"."schema_sdl_store_id" = "sdl_store"."id"
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
          `);
        }

        if (data.targetIds.length && data.contextIds.length) {
          deletedSchemaChangeApprovalCount = await pool.oneFirst<number>(sql`
            WITH "deleted" AS (
              DELETE
              FROM
                "schema_change_approvals"
              WHERE
                "target_id" = ANY(
                  ${sql.array(data.targetIds, 'uuid')}
                )
                AND "context_id" = ANY(
                  ${sql.array(data.contextIds, 'text')}
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
                "id"
            ) SELECT COUNT(*) FROM "deleted"
          `);
        }

        if (data.contractIds.length && data.contextIds.length) {
          deletedContractSchemaChangeApprovalCount = await pool.oneFirst<number>(sql`
            WITH "deleted" AS (
              DELETE
              FROM
                "contract_schema_change_approvals"
              WHERE
                "contract_id" = ANY(
                  ${sql.array(data.contractIds, 'uuid')}
                )
                AND "context_id" = ANY(
                  ${sql.array(data.contextIds, 'text')}
                )
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM "contract_checks"
                  WHERE
                    "contract_checks"."contract_id" = "contract_schema_change_approvals"."contract_id"
                    AND "contract_checks"."context_id" = "contract_schema_change_approvals"."context_id"
                )
              RETURNING
                "id"
            ) SELECT COUNT(*) FROM "deleted"
          `);
        }

        return {
          deletedSchemaCheckCount: data.schemaCheckIds.length,
          deletedSdlStoreCount,
          deletedSchemaChangeApprovalCount,
          deletedContractSchemaChangeApprovalCount,
        };
      });
    },

    async getSchemaVersionByActionId(args) {
      const record = await pool.maybeOne<unknown>(sql`
        SELECT
          ${schemaVersionSQLFields()}
        FROM
          "schema_versions"
        WHERE
          "action_id" = ANY(
            SELECT
              "id"
            FROM
              "schema_log"
            WHERE
              "schema_log"."project_id" = ${args.projectId}
              AND "schema_log"."target_id" = ${args.targetId}
              AND "schema_log"."commit" = ${args.actionId}
          )
        LIMIT 1
      `);

      if (!record) {
        return null;
      }

      return SchemaVersionModel.parse(record);
    },
    // Zendesk
    async setZendeskOrganizationId({ organizationId, zendeskId }) {
      await pool.query(sql`
        UPDATE
          "organizations"
        SET
          "zendesk_organization_id" = ${zendeskId}
        WHERE
          "id" = ${organizationId}
      `);
    },
    async setZendeskUserId({ userId, zendeskId }) {
      await pool.query(sql`
        UPDATE
          "users"
        SET
          "zendesk_user_id" = ${zendeskId}
        WHERE
          "id" = ${userId}
      `);
    },
    async setZendeskOrganizationUserConnection({ organizationId, userId }) {
      await pool.query(sql`
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

function isDefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}

const OktaIntegrationBaseModel = zod.object({
  id: zod.string(),
  linked_organization_id: zod.string(),
  client_id: zod.string(),
  client_secret: zod.string(),
});

const OktaIntegrationLegacyModel = zod.intersection(
  OktaIntegrationBaseModel,
  zod.object({
    oauth_api_url: zod.string().url(),
  }),
);

const OktaIntegrationModel = zod.intersection(
  OktaIntegrationBaseModel,
  zod.object({
    token_endpoint: zod.string().url(),
    userinfo_endpoint: zod.string().url(),
    authorization_endpoint: zod.string().url(),
  }),
);

const OktaIntegrationModelUnion = zod.union([OktaIntegrationLegacyModel, OktaIntegrationModel]);

const decodeOktaIntegrationRecord = (result: unknown): OIDCIntegration => {
  const rawRecord = OktaIntegrationModelUnion.parse(result);

  // handle legacy case
  if ('oauth_api_url' in rawRecord) {
    return {
      id: rawRecord.id,
      clientId: rawRecord.client_id,
      encryptedClientSecret: rawRecord.client_secret,
      linkedOrganizationId: rawRecord.linked_organization_id,
      tokenEndpoint: `${rawRecord.oauth_api_url}/token`,
      userinfoEndpoint: `${rawRecord.oauth_api_url}/userinfo`,
      authorizationEndpoint: `${rawRecord.oauth_api_url}/authorize`,
    };
  }

  return {
    id: rawRecord.id,
    clientId: rawRecord.client_id,
    encryptedClientSecret: rawRecord.client_secret,
    linkedOrganizationId: rawRecord.linked_organization_id,
    tokenEndpoint: rawRecord.token_endpoint,
    userinfoEndpoint: rawRecord.userinfo_endpoint,
    authorizationEndpoint: rawRecord.authorization_endpoint,
  };
};

const CDNAccessTokenModel = zod.object({
  id: zod.string(),
  target_id: zod.string(),
  s3_key: zod.string(),
  first_characters: zod.string(),
  last_characters: zod.string(),
  alias: zod.string(),
  created_at: zod.string(),
});

const decodeCDNAccessTokenRecord = (result: unknown): CDNAccessToken => {
  const rawRecord = CDNAccessTokenModel.parse(result);

  return {
    id: rawRecord.id,
    targetId: rawRecord.target_id,
    s3Key: rawRecord.s3_key,
    firstCharacters: rawRecord.first_characters,
    lastCharacters: rawRecord.last_characters,
    alias: rawRecord.alias,
    createdAt: rawRecord.created_at,
  };
};

const FeatureFlagsModel = zod
  .object({
    compareToPreviousComposableVersion: zod.boolean().default(false),
  })
  .optional()
  .nullable()
  .default({})
  .transform(
    val =>
      val ?? {
        compareToPreviousComposableVersion: false,
      },
  );

function decodeFeatureFlags(column: unknown) {
  return FeatureFlagsModel.parse(column);
}

/**  This version introduced the "diffSchemaVersionId" column. */
const SchemaVersionRecordVersion_2024_01_10_Model = zod.literal('2024-01-10');

const SchemaVersionRecordVersionModel = SchemaVersionRecordVersion_2024_01_10_Model;

const SchemaVersionModel = zod.intersection(
  zod.object({
    id: zod.string(),
    isComposable: zod.boolean(),
    createdAt: zod.string(),
    baseSchema: zod.nullable(zod.string()),
    actionId: zod.string(),
    hasPersistedSchemaChanges: zod.nullable(zod.boolean()).transform(val => val ?? false),
    previousSchemaVersionId: zod.nullable(zod.string()),
    diffSchemaVersionId: zod.nullable(zod.string()),
    compositeSchemaSDL: zod.nullable(zod.string()),
    supergraphSDL: zod.nullable(zod.string()),
    schemaCompositionErrors: zod.nullable(zod.array(SchemaCompositionErrorModel)),
    recordVersion: zod.nullable(SchemaVersionRecordVersionModel),
    tags: zod.nullable(zod.array(zod.string())),
    hasContractCompositionErrors: zod
      .boolean()
      .nullable()
      .transform(val => val ?? false),
  }),
  zod
    .union([
      zod.object({
        githubRepository: zod.string(),
        githubSha: zod.string(),
      }),
      zod.object({
        githubRepository: zod.null(),
        githubSha: zod.null(),
      }),
    ])
    .transform(val => ({
      github: val.githubRepository
        ? {
            repository: val.githubRepository,
            sha: val.githubSha,
          }
        : null,
    })),
);

export type SchemaVersion = zod.infer<typeof SchemaVersionModel>;

const DocumentCollectionModel = zod.object({
  id: zod.string(),
  title: zod.string(),
  description: zod.union([zod.string(), zod.null()]),
  targetId: zod.string(),
  createdByUserId: zod.union([zod.string(), zod.null()]),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});

const DocumentCollectionDocumentModel = zod.object({
  id: zod.string(),
  title: zod.string(),
  contents: zod.string(),
  variables: zod.string().nullable(),
  headers: zod.string().nullable(),
  createdByUserId: zod.union([zod.string(), zod.null()]),
  documentCollectionId: zod.string(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
});

/**
 * Insert a schema version changes into the database.
 */
async function insertSchemaVersionContractChanges(
  trx: DatabaseTransactionConnection,
  args: {
    changes: Array<SchemaChangeType> | null;
    schemaVersionContractId: string;
  },
) {
  if (!args.changes?.length) {
    return;
  }

  await trx.query(sql`
    INSERT INTO "contract_version_changes" (
      "contract_version_id",
      "change_type",
      "severity_level",
      "meta",
      "is_safe_based_on_usage"
    )
    SELECT * FROM
    ${sql.unnest(
      args.changes.map(change =>
        // Note: change.criticality.level is actually a computed value from meta
        [
          args.schemaVersionContractId,
          change.type,
          change.criticality,
          JSON.stringify(change.meta),
          change.isSafeBasedOnUsage ?? false,
        ],
      ),
      ['uuid', 'text', 'text', 'jsonb', 'bool'],
    )}
  `);
}

/**
 * Insert a schema version changes into the database.
 */
async function insertSchemaVersionChanges(
  trx: DatabaseTransactionConnection,
  args: {
    changes: Array<SchemaChangeType>;
    versionId: string;
  },
) {
  if (args.changes.length === 0) {
    return;
  }

  await trx.query(sql`
    INSERT INTO schema_version_changes (
      "schema_version_id",
      "change_type",
      "severity_level",
      "meta",
      "is_safe_based_on_usage"
    )
    SELECT * FROM
    ${sql.unnest(
      args.changes.map(change =>
        // Note: change.criticality.level is actually a computed value from meta
        [
          args.versionId,
          change.type,
          change.criticality,
          JSON.stringify(change.meta),
          change.isSafeBasedOnUsage ?? false,
        ],
      ),
      ['uuid', 'text', 'text', 'jsonb', 'bool'],
    )}
  `);
}

/**
 * Insert a new schema version into the database.
 */
async function insertSchemaVersion(
  trx: DatabaseTransactionConnection,
  args: {
    isComposable: boolean;
    targetId: string;
    actionId: string;
    baseSchema: string | null;
    previousSchemaVersion: string | null;
    diffSchemaVersionId: string | null;
    compositeSchemaSDL: string | null;
    supergraphSDL: string | null;
    schemaCompositionErrors: Array<SchemaCompositionError> | null;
    tags: Array<string> | null;
    hasContractCompositionErrors: boolean;
    github: null | {
      sha: string;
      repository: string;
    };
  },
) {
  const query = sql`
    INSERT INTO schema_versions
      (
        record_version,
        is_composable,
        target_id,
        action_id,
        base_schema,
        has_persisted_schema_changes,
        previous_schema_version_id,
        diff_schema_version_id,
        composite_schema_sdl,
        supergraph_sdl,
        schema_composition_errors,
        github_repository,
        github_sha,
        tags,
        has_contract_composition_errors
      )
    VALUES
      (
        '2024-01-10',
        ${args.isComposable},
        ${args.targetId},
        ${args.actionId},
        ${args.baseSchema},
        ${true},
        ${args.previousSchemaVersion},
        ${args.diffSchemaVersionId},
        ${args.compositeSchemaSDL},
        ${args.supergraphSDL},
        ${
          args.schemaCompositionErrors
            ? sql`${JSON.stringify(args.schemaCompositionErrors)}::jsonb`
            : sql`${null}`
        },
        ${args.github?.repository ?? null},
        ${args.github?.sha ?? null},
        ${Array.isArray(args.tags) ? sql.array(args.tags, 'text') : null},
        ${args.hasContractCompositionErrors}
      )
    RETURNING
      ${schemaVersionSQLFields()}
  `;

  return await trx.one(query).then(SchemaVersionModel.parse);
}

async function insertSchemaVersionContract(
  trx: DatabaseTransactionConnection,
  args: {
    schemaVersionId: string;
    contractId: string;
    contractName: string;
    compositeSchemaSDL: string | null;
    supergraphSDL: string | null;
    schemaCompositionErrors: Array<SchemaCompositionError> | null;
  },
): Promise<string> {
  const id = await trx.oneFirst(sql`
    INSERT INTO "contract_versions" (
      "schema_version_id"
      , "contract_id"
      , "contract_name"
      , "schema_composition_errors"
      , "composite_schema_sdl"
      , "supergraph_sdl"
    )
    VALUES (
      ${args.schemaVersionId}
      , ${args.contractId}
      , ${args.contractName}
      , ${jsonify(args.schemaCompositionErrors)}
      , ${args.compositeSchemaSDL}
      , ${args.supergraphSDL}
    )
    RETURNING
      "id"
  `);

  return zod.string().parse(id);
}

/**
 * Small helper utility for jsonifying a nullable object.
 */
function jsonify<T>(obj: T | null | undefined) {
  if (obj == null) return null;
  return sql`${JSON.stringify(obj)}::jsonb`;
}

/**
 * Utility function for stripping a schema change of its computable properties for efficient storage in the database.
 */
export function toSerializableSchemaChange(change: SchemaChangeType): {
  id: string;
  type: string;
  meta: Record<string, SerializableValue>;
  approvalMetadata: null | {
    userId: string;
    date: string;
    schemaCheckId: string;
  };
  isSafeBasedOnUsage: boolean;
} {
  return {
    id: change.id,
    type: change.type,
    meta: change.meta,
    isSafeBasedOnUsage: change.isSafeBasedOnUsage,
    approvalMetadata: change.approvalMetadata,
  };
}

const schemaCheckSQLFields = sql`
    c."id"
  , to_json(c."created_at") as "createdAt"
  , to_json(c."updated_at") as "updatedAt"
  , coalesce(c."schema_sdl", s_schema."sdl") as "schemaSDL"
  , c."service_name" as "serviceName"
  , c."meta"
  , c."target_id" as "targetId"
  , c."schema_version_id" as "schemaVersionId"
  , c."is_success" as "isSuccess"
  , c."schema_composition_errors" as "schemaCompositionErrors"
  , c."breaking_schema_changes" as "breakingSchemaChanges"
  , c."safe_schema_changes" as "safeSchemaChanges"
  , c."schema_policy_warnings" as "schemaPolicyWarnings"
  , c."schema_policy_errors" as "schemaPolicyErrors"
  , coalesce(c."composite_schema_sdl", s_composite_schema."sdl") as "compositeSchemaSDL"
  , coalesce(c."supergraph_sdl", s_supergraph."sdl") as "supergraphSDL"
  , c."github_check_run_id" as "githubCheckRunId"
  , c."github_repository" as "githubRepository"
  , c."github_sha" as "githubSha"
  , coalesce(c."is_manually_approved", false) as "isManuallyApproved"
  , c."manual_approval_user_id" as "manualApprovalUserId"
  , c."context_id" as "contextId"
`;

const schemaVersionSQLFields = (t = sql``) => sql`
  ${t}"id"
  , ${t}"is_composable" as "isComposable"
  , to_json(${t}"created_at") as "createdAt"
  , ${t}"action_id" as "actionId"
  , ${t}"base_schema" as "baseSchema"
  , ${t}"has_persisted_schema_changes" as "hasPersistedSchemaChanges"
  , ${t}"previous_schema_version_id" as "previousSchemaVersionId"
  , ${t}"composite_schema_sdl" as "compositeSchemaSDL"
  , ${t}"supergraph_sdl" as "supergraphSDL"
  , ${t}"schema_composition_errors" as "schemaCompositionErrors"
  , ${t}"github_repository" as "githubRepository"
  , ${t}"github_sha" as "githubSha"
  , ${t}"diff_schema_version_id" as "diffSchemaVersionId"
  , ${t}"record_version" as "recordVersion"
  , ${t}"tags"
  , ${t}"has_contract_composition_errors" as "hasContractCompositionErrors"
`;

const targetSQLFields = sql`
  "id",
  "clean_id" as "cleanId",
  "name",
  "project_id" as "projectId",
  "graphql_endpoint_url" as "graphqlEndpointUrl"
`;

const TargetModel = zod.object({
  id: zod.string(),
  cleanId: zod.string(),
  name: zod.string(),
  projectId: zod.string(),
  graphqlEndpointUrl: zod.string().nullable(),
});

export * from './schema-change-model';
export {
  buildRegistryServiceURLFromMeta,
  type RegistryServiceUrlChangeSerializableChange,
} from './schema-change-meta';

export type PaginatedSchemaVersionConnection = Readonly<{
  edges: ReadonlyArray<{
    cursor: string;
    node: SchemaVersion;
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;
