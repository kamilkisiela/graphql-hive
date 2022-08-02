import type {
  User,
  Organization,
  Project,
  Target,
  Schema,
  SchemaVersion,
  Member,
  ActivityObject,
  TargetSettings,
  PersistedOperation,
  AlertChannel,
  Alert,
  AuthProvider,
  OrganizationBilling,
  Storage,
  ProjectType,
  OrganizationType,
} from '@hive/api';
import { sql, TaggedTemplateLiteralInvocationType } from 'slonik';
import { update } from 'slonik-utilities';
import {
  commits,
  getPool,
  organizations,
  organization_member,
  projects,
  targets,
  target_validation,
  users,
  versions,
  version_commit,
  objectToParams,
  activities,
  persisted_operations,
  alert_channels,
  alerts,
  organizations_billing,
} from './db';
import { batch } from '@theguild/buddy';
import type { Slonik } from './shared';

export { createConnectionString } from './db/utils';
export { createTokenStorage } from './tokens';
export type { tokens } from './db/types';

export type WithUrl<T> = T & Pick<version_commit, 'url'>;
export type WithMaybeMetadata<T> = T & {
  metadata?: string | null;
};

const organizationGetStartedMapping: Record<Exclude<keyof Organization['getStarted'], 'id'>, keyof organizations> = {
  creatingProject: 'get_started_creating_project',
  publishingSchema: 'get_started_publishing_schema',
  checkingSchema: 'get_started_checking_schema',
  invitingMembers: 'get_started_inviting_members',
  reportingOperations: 'get_started_reporting_operations',
  enablingUsageBasedBreakingChanges: 'get_started_usage_breaking',
};

function getProviderBasedOnExternalId(externalId: string): AuthProvider {
  if (externalId.startsWith('github')) {
    return 'GITHUB';
  }

  if (externalId.startsWith('google')) {
    return 'GOOGLE';
  }

  return 'AUTH0';
}

export async function createStorage(connection: string): Promise<Storage> {
  const pool = getPool(connection);

  function transformUser(user: users): User {
    return {
      id: user.id,
      email: user.email,
      externalAuthUserId: user.external_auth_user_id,
      provider: getProviderBasedOnExternalId(user.external_auth_user_id),
      fullName: user.full_name,
      displayName: user.display_name,
    };
  }

  function transformMember(user: users & Pick<organization_member, 'scopes' | 'organization_id'>): Member {
    return {
      id: user.id,
      user: transformUser(user),
      scopes: (user.scopes as Member['scopes']) || [],
      organization: user.organization_id,
    };
  }

  function transformOrganization(organization: organizations): Organization {
    return {
      id: organization.id,
      cleanId: organization.clean_id,
      name: organization.name,
      inviteCode: organization.invite_code,
      monthlyRateLimit: {
        retentionInDays: parseInt(organization.limit_retention_days),
        operations: parseInt(organization.limit_operations_monthly),
      },
      billingPlan: organization.plan_name,
      type: (organization.type === 'PERSONAL' ? 'PERSONAL' : 'REGULAR') as OrganizationType,
      getStarted: {
        id: organization.id,
        creatingProject: organization.get_started_creating_project,
        publishingSchema: organization.get_started_publishing_schema,
        checkingSchema: organization.get_started_checking_schema,
        invitingMembers: organization.get_started_inviting_members,
        reportingOperations: organization.get_started_reporting_operations,
        enablingUsageBasedBreakingChanges: organization.get_started_usage_breaking,
      },
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
      gitRepository: project.git_repository,
    };
  }

  function transformTarget(target: targets, orgId: string): Target {
    return {
      id: target.id,
      cleanId: target.clean_id,
      name: target.name,
      projectId: target.project_id,
      orgId,
    };
  }

  function transformSchema(
    schema: WithUrl<
      WithMaybeMetadata<
        Pick<commits, 'id' | 'commit' | 'author' | 'content' | 'created_at' | 'project_id' | 'service' | 'target_id'>
      >
    >
  ): Schema {
    const record: Schema = {
      id: schema.id,
      author: schema.author,
      source: schema.content,
      commit: schema.commit,
      date: schema.created_at as any,
      service: schema.service,
      url: schema.url,
      target: schema.target_id,
    };
    if (schema.metadata != null) {
      record.metadata = JSON.parse(schema.metadata);
    }

    return record;
  }

  function transformSchemaVersion(version: versions): SchemaVersion {
    return {
      id: version.id,
      valid: version.valid,
      date: version.created_at as any,
      commit: version.commit_id,
      base_schema: version.base_schema,
    };
  }

  function transformActivity(row: {
    activity: [activities];
    target: [targets];
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
      target: target ? transformTarget(target, organization.id) : undefined,
      project: project ? transformProject(project) : undefined,
      organization: transformOrganization(organization),
      user: user ? transformUser(user) : undefined,
    };
  }

  function transformTargetSettings(
    row: Pick<
      targets,
      'validation_enabled' | 'validation_percentage' | 'validation_period' | 'validation_excluded_clients'
    > & {
      targets: target_validation['destination_target_id'][] | null;
    }
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

  function transformPersistedOperation(operation: persisted_operations): PersistedOperation {
    return {
      id: operation.id,
      operationHash: operation.operation_hash,
      name: operation.operation_name,
      kind: operation.operation_kind as any,
      project: operation.project_id,
      content: operation.content,
      date: operation.created_at as any,
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

  const storage: Storage = {
    async getUserByExternalId({ external }) {
      const user = await pool.maybeOne<Slonik<users>>(
        sql`SELECT * FROM public.users WHERE external_auth_user_id = ${external} LIMIT 1`
      );

      if (user) {
        return transformUser(user);
      }

      return null;
    },
    async getUserById({ id }) {
      const user = await pool.maybeOne<Slonik<users>>(sql`SELECT * FROM public.users WHERE id = ${id} LIMIT 1`);

      if (user) {
        return transformUser(user);
      }

      return null;
    },
    async createUser({ external, email, fullName, displayName }) {
      return transformUser(
        await pool.one<Slonik<users>>(
          sql`
            INSERT INTO public.users
              ("email", "external_auth_user_id", "full_name", "display_name")
            VALUES
              (${email}, ${external}, ${fullName}, ${displayName})
            RETURNING *
          `
        )
      );
    },
    async updateUser({ id, displayName, fullName }) {
      return transformUser(
        await pool.one<Slonik<users>>(sql`
          UPDATE public.users
          SET display_name = ${displayName}, full_name = ${fullName}
          WHERE id = ${id}
          RETURNING *
        `)
      );
    },
    async createOrganization({ name, cleanId, type, user, scopes }) {
      const org = transformOrganization(
        await pool.one<Slonik<organizations>>(
          sql`
            INSERT INTO public.organizations
              ("name", "clean_id", "type", "user_id")
            VALUES
              (${name}, ${cleanId}, ${type}, ${user})
            RETURNING *
          `
        )
      );

      await pool.query<Slonik<organization_member>>(
        sql`
          INSERT INTO public.organization_member
            ("organization_id", "user_id", "scopes")
          VALUES
            (${org.id}, ${user}, ${sql.array(scopes, 'text')})
        `
      );

      return org;
    },
    async deleteOrganization({ organization }) {
      const result = transformOrganization(
        await pool.one<Slonik<organizations>>(
          sql`
            DELETE FROM public.organizations
            WHERE id = ${organization}
            RETURNING *
          `
        )
      );

      return result;
    },
    async createProject({ name, organization, cleanId, type, buildUrl = null, validationUrl = null }) {
      return transformProject(
        await pool.one<Slonik<projects>>(
          sql`
            INSERT INTO public.projects
              ("name", "clean_id", "type", "org_id", "build_url", "validation_url")
            VALUES
              (${name}, ${cleanId}, ${type}, ${organization}, ${buildUrl}, ${validationUrl})
            RETURNING *
          `
        )
      );
    },
    async getOrganizationId({ organization }) {
      // Based on clean_id, resolve id
      const result = await pool.one<Pick<organizations, 'id'>>(
        sql`SELECT id FROM public.organizations WHERE clean_id = ${organization} LIMIT 1`
      );

      return result.id as string;
    },
    getOrganizationOwner: batch(async selectors => {
      const organizations = selectors.map(s => s.organization);
      const owners = await pool.query<Slonik<users & Pick<organization_member, 'scopes' | 'organization_id'>>>(
        sql`
        SELECT u.*, om.scopes, om.organization_id FROM public.organizations as o
        LEFT JOIN public.users as u ON (u.id = o.user_id)
        LEFT JOIN public.organization_member as om ON (om.user_id = u.id AND om.organization_id = o.id)
        WHERE o.id IN (${sql.join(organizations, sql`, `)})`
      );

      return organizations.map(organization => {
        const owner = owners.rows.find(row => row.organization_id === organization);

        if (owner) {
          return Promise.resolve(transformMember(owner));
        }

        return Promise.reject(new Error(`Owner not found (organization=${organization})`));
      });
    }),
    getOrganizationMembers: batch(async selectors => {
      const organizations = selectors.map(s => s.organization);
      const allMembers = await pool.query<Slonik<users & Pick<organization_member, 'scopes' | 'organization_id'>>>(
        sql`
        SELECT u.*, om.scopes, om.organization_id FROM public.organization_member as om
        LEFT JOIN public.users as u ON (u.id = om.user_id)
        WHERE om.organization_id IN (${sql.join(organizations, sql`, `)}) ORDER BY u.created_at DESC`
      );

      return organizations.map(organization => {
        const members = allMembers.rows.filter(row => row.organization_id === organization);

        if (members) {
          return Promise.resolve(members.map(transformMember));
        }

        return Promise.reject(new Error(`Members not found (organization=${organization})`));
      });
    }),
    async getOrganizationMember({ organization, user }) {
      const member = await pool.one<Slonik<users & Pick<organization_member, 'organization_id' | 'scopes'>>>(
        sql`
          SELECT u.*, om.scopes, om.organization_id FROM public.organization_member as om
          LEFT JOIN public.users as u ON (u.id = om.user_id)
          WHERE om.organization_id = ${organization} AND om.user_id = ${user} ORDER BY u.created_at DESC LIMIT 1`
      );

      return transformMember(member);
    },
    async getOrganizationMemberAccessPairs(pairs) {
      const results = await pool.query<Slonik<Pick<organization_member, 'organization_id' | 'user_id' | 'scopes'>>>(
        sql`
          SELECT organization_id, user_id, scopes
          FROM public.organization_member
          WHERE (organization_id, user_id) IN ((${sql.join(
            pairs.map(p => sql`${p.organization}, ${p.user}`),
            sql`), (`
          )}))
        `
      );

      return pairs.map(({ organization, user }) => {
        return (results.rows.find(row => row.organization_id === organization && row.user_id === user)?.scopes ||
          []) as Member['scopes'];
      });
    },
    async hasOrganizationMemberPairs(pairs) {
      const results = await pool.query<Slonik<organization_member>>(
        sql`
          SELECT organization_id, user_id
          FROM public.organization_member
          WHERE (organization_id, user_id) IN ((${sql.join(
            pairs.map(p => sql`${p.organization}, ${p.user}`),
            sql`), (`
          )}))
        `
      );

      return pairs.map(({ organization, user }) =>
        results.rows.some(row => row.organization_id === organization && row.user_id === user)
      );
    },
    async hasOrganizationProjectMemberPairs(pairs) {
      const results = await pool.query<Slonik<organization_member & { project_id: string }>>(
        sql`
          SELECT om.organization_id, om.user_id, p.id AS project_id
          FROM public.projects as p
          LEFT JOIN public.organization_member as om ON (p.org_id = om.organization_id)
          WHERE (om.organization_id, om.user_id, p.id) IN ((${sql.join(
            pairs.map(p => sql`${p.organization}, ${p.user}, ${p.project}`),
            sql`), (`
          )}))
        `
      );

      return pairs.map(({ organization, user, project }) =>
        results.rows.some(
          row => row.organization_id === organization && row.project_id === project && row.user_id === user
        )
      );
    },
    async updateOrganizationName({ name, cleanId, organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE public.organizations
          SET name = ${name}, clean_id = ${cleanId}
          WHERE id = ${organization}
          RETURNING *
        `)
      );
    },
    async updateOrganizationPlan({ billingPlan, organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE public.organizations
          SET plan_name = ${billingPlan}
          WHERE id = ${organization}
          RETURNING *
        `)
      );
    },
    async updateOrganizationRateLimits({ monthlyRateLimit, organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE public.organizations
          SET limit_operations_monthly = ${monthlyRateLimit.operations}, limit_retention_days = ${monthlyRateLimit.retentionInDays}
          WHERE id = ${organization}
          RETURNING *
        `)
      );
    },
    async updateOrganizationInviteCode({ organization, inviteCode }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(sql`
          UPDATE public.organizations
          SET invite_code = ${inviteCode}
          WHERE id = ${organization}
          RETURNING *
        `)
      );
    },
    async addOrganizationMember({ user, organization, scopes }) {
      await pool.one<Slonik<organization_member>>(
        sql`
          INSERT INTO public.organization_member
            (organization_id, user_id, scopes)
          VALUES
            (${organization}, ${user}, ${sql.array(scopes, 'text')})
          RETURNING *
        `
      );
    },
    async deleteOrganizationMembers({ users, organization }) {
      await pool.query<Slonik<organization_member>>(
        sql`
          DELETE FROM public.organization_member
          WHERE organization_id = ${organization} AND user_id IN (${sql.join(users, sql`, `)})
        `
      );
    },
    async updateOrganizationMemberAccess({ user, organization, scopes }) {
      await pool.query<Slonik<organization_member>>(
        sql`
          UPDATE public.organization_member
          SET scopes = ${sql.array(scopes, 'text')}
          WHERE organization_id = ${organization} AND user_id = ${user}
        `
      );
    },
    async getProjectId({ project, organization }) {
      // Based on project's clean_id and organization's clean_id, resolve the actual uuid of the project
      const result = await pool.one<Pick<projects, 'id'>>(
        sql`SELECT p.id as id
        FROM public.projects as p
        LEFT JOIN public.organizations as org ON (p.org_id = org.id)
        WHERE p.clean_id = ${project} AND org.clean_id = ${organization} LIMIT 1`
      );

      return result.id as string;
    },
    async getTargetId({ project, target, organization, useIds }) {
      if (useIds) {
        const result = await pool.one<Pick<targets, 'id'>>(
          sql`
          SELECT t.id FROM public.targets as t
          LEFT JOIN public.projects AS p ON (p.id = t.project_id)
          LEFT JOIN public.organizations AS o ON (o.id = p.org_id)
          WHERE t.clean_id = ${target} AND p.id = ${project} AND o.id = ${organization}
          LIMIT 1`
        );

        return result.id as string;
      }

      // Based on clean_id, resolve id
      const result = await pool.one<Pick<targets, 'id'>>(
        sql`
          SELECT t.id FROM public.targets as t
          LEFT JOIN public.projects AS p ON (p.id = t.project_id)
          LEFT JOIN public.organizations AS o ON (o.id = p.org_id)
          WHERE t.clean_id = ${target} AND p.clean_id = ${project} AND o.clean_id = ${organization}
          LIMIT 1`
      );

      return result.id as string;
    },
    async getPersistedOperationId({ project, operation }) {
      const result = await pool.one<Pick<persisted_operations, 'id'>>(
        sql`
          SELECT po.id FROM public.persisted_operations as po
          LEFT JOIN public.projects AS p ON (p.id = po.project_id)
          WHERE po.operation_hash = ${operation} AND p.clean_id = ${project}
          LIMIT 1`
      );

      return result.id;
    },
    async getOrganization({ organization }) {
      return transformOrganization(
        await pool.one<Slonik<organizations>>(
          sql`SELECT * FROM public.organizations WHERE id = ${organization} LIMIT 1`
        )
      );
    },
    async getMyOrganization({ user }) {
      const org = await pool.maybeOne<Slonik<organizations>>(
        sql`SELECT * FROM public.organizations WHERE user_id = ${user} AND type = ${'PERSONAL'} LIMIT 1`
      );

      return org ? transformOrganization(org) : null;
    },
    async getOrganizations({ user }) {
      const results = await pool.many<Slonik<organizations>>(
        sql`
          SELECT o.*
          FROM public.organizations as o
          LEFT JOIN public.organization_member as om ON (om.organization_id = o.id)
          WHERE om.user_id = ${user}
          ORDER BY o.created_at DESC
        `
      );
      return results.map(transformOrganization);
    },
    async getOrganizationByInviteCode({ inviteCode }) {
      const result = await pool.maybeOne<Slonik<organizations>>(
        sql`
          SELECT * FROM public.organizations
          WHERE invite_code = ${inviteCode}
          LIMIT 1
        `
      );

      if (result) {
        return transformOrganization(result);
      }

      return null;
    },
    async getOrganizationByCleanId({ cleanId }) {
      const result = await pool.maybeOne<Slonik<organizations>>(
        sql`SELECT * FROM public.organizations WHERE clean_id = ${cleanId} LIMIT 1`
      );

      if (!result) {
        return null;
      }

      return transformOrganization(result);
    },
    async getOrganizationByGitHubInstallationId({ installationId }) {
      const result = await pool.maybeOne<Slonik<organizations>>(
        sql`
          SELECT * FROM public.organizations
          WHERE github_app_installation_id = ${installationId}
          LIMIT 1
        `
      );

      if (result) {
        return transformOrganization(result);
      }

      return null;
    },
    async getProject({ project }) {
      return transformProject(
        await pool.one<Slonik<projects>>(sql`SELECT * FROM public.projects WHERE id = ${project} LIMIT 1`)
      );
    },
    async getProjectByCleanId({ cleanId, organization }) {
      const result = await pool.maybeOne<Slonik<projects>>(
        sql`SELECT * FROM public.projects WHERE clean_id = ${cleanId} AND org_id = ${organization} LIMIT 1`
      );

      if (!result) {
        return null;
      }

      return transformProject(result);
    },
    async getProjects({ organization }) {
      const result = await pool.query<Slonik<projects>>(
        sql`SELECT * FROM public.projects WHERE org_id = ${organization} ORDER BY created_at DESC`
      );

      return result.rows.map(transformProject);
    },
    async updateProjectName({ name, cleanId, organization, project }) {
      return transformProject(
        await pool.one<Slonik<projects>>(sql`
          UPDATE public.projects
          SET name = ${name}, clean_id = ${cleanId}
          WHERE id = ${project} AND org_id = ${organization}
          RETURNING *
        `)
      );
    },
    async updateProjectGitRepository({ gitRepository, organization, project }) {
      return transformProject(
        await pool.one<Slonik<projects>>(sql`
          UPDATE public.projects
          SET git_repository = ${gitRepository ?? null}
          WHERE id = ${project} AND org_id = ${organization}
          RETURNING *
        `)
      );
    },
    async deleteProject({ organization, project }) {
      const result = transformProject(
        await pool.one<Slonik<projects>>(
          sql`
            DELETE FROM public.projects
            WHERE id = ${project} AND org_id = ${organization}
            RETURNING *
          `
        )
      );

      return result;
    },
    async createTarget({ organization, project, name, cleanId }) {
      return transformTarget(
        await pool.one<Slonik<targets>>(
          sql`
            INSERT INTO public.targets
              (name, clean_id, project_id)
            VALUES
              (${name}, ${cleanId}, ${project})
            RETURNING *
          `
        ),
        organization
      );
    },
    async updateTargetName({ organization, project, target, name, cleanId }) {
      return transformTarget(
        await pool.one<Slonik<targets>>(sql`
          UPDATE public.targets
          SET name = ${name}, clean_id = ${cleanId}
          WHERE id = ${target} AND project_id = ${project}
          RETURNING *
        `),
        organization
      );
    },
    async deleteTarget({ organization, project, target }) {
      const result = transformTarget(
        await pool.one<Slonik<targets>>(
          sql`
            DELETE FROM public.targets
            WHERE id = ${target} AND project_id = ${project}
            RETURNING *
          `
        ),
        organization
      );

      await pool.query(sql`DELETE FROM public.versions WHERE target_id = ${target}`);

      return result;
    },
    getTarget: batch(
      async (
        selectors: Array<{
          organization: string;
          project: string;
          target: string;
        }>
      ) => {
        const uniqueSelectorsMap = new Map<string, typeof selectors[0]>();

        for (const selector of selectors) {
          const key = JSON.stringify({
            organization: selector.organization,
            project: selector.project,
            target: selector.target,
          });

          uniqueSelectorsMap.set(key, selector);
        }

        const uniqueSelectors = Array.from(uniqueSelectorsMap.values());

        const rows = await pool.many<Slonik<targets>>(
          sql`
            SELECT * FROM public.targets
            WHERE (id, project_id) IN ((${sql.join(
              uniqueSelectors.map(s => sql`${s.target}, ${s.project}`),
              sql`), (`
            )}))
          `
        );

        return selectors.map(selector => {
          const row = rows.find(row => row.id === selector.target && row.project_id === selector.project);

          if (!row) {
            return Promise.reject(
              new Error(`Target not found (target=${selector.target}, project=${selector.project})`)
            );
          }

          return Promise.resolve(transformTarget(row, selector.organization));
        });
      }
    ),
    async getTargetByCleanId({ organization, project, cleanId }) {
      const result = await pool.maybeOne<Slonik<targets>>(
        sql`SELECT * FROM public.targets WHERE clean_id = ${cleanId} AND project_id = ${project} LIMIT 1`
      );

      if (!result) {
        return null;
      }

      return transformTarget(result, organization);
    },
    async getTargets({ organization, project }) {
      const results = await pool.query<Slonik<targets>>(
        sql`SELECT * FROM public.targets WHERE project_id = ${project} ORDER BY created_at DESC`
      );

      return results.rows.map(r => transformTarget(r, organization));
    },
    async getTargetIdsOfOrganization({ organization }) {
      const results = await pool.query<Slonik<Pick<targets, 'id'>>>(
        sql`
          SELECT t.id as id FROM public.targets as t 
          LEFT JOIN public.projects as p ON (p.id = t.project_id)
          WHERE p.org_id = ${organization}
          GROUP BY t.id
        `
      );

      return results.rows.map(r => r.id);
    },
    async getTargetSettings({ target, project }) {
      const row = await pool.one<
        Pick<
          targets,
          'validation_enabled' | 'validation_percentage' | 'validation_period' | 'validation_excluded_clients'
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
        FROM public.targets AS t
        LEFT JOIN public.target_validation AS tv ON (tv.target_id = t.id)
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
              'validation_enabled' | 'validation_percentage' | 'validation_period' | 'validation_excluded_clients'
            > & {
              targets: target_validation['destination_target_id'][];
            }
          >(sql`
          UPDATE public.targets as t
          SET validation_enabled = ${enabled}
          FROM
            (
              SELECT
                  it.id,
                  array_agg(tv.destination_target_id) as targets
              FROM public.targets AS it
              LEFT JOIN public.target_validation AS tv ON (tv.target_id = it.id)
              WHERE it.id = ${target} AND it.project_id = ${project}
              GROUP BY it.id
              LIMIT 1
            ) ret
          WHERE t.id = ret.id
          RETURNING ret.id, t.validation_enabled, t.validation_percentage, t.validation_period, t.validation_excluded_clients, ret.targets
        `);
        })
      ).validation;
    },
    async updateTargetValidationSettings({ target, project, percentage, period, targets, excludedClients }) {
      return transformTargetSettings(
        await pool.transaction(async trx => {
          await trx.query(sql`
            DELETE
            FROM public.target_validation
            WHERE destination_target_id NOT IN (${sql.join(targets, sql`, `)})
              AND target_id = ${target}
          `);

          await trx.query(sql`
            INSERT INTO public.target_validation
              (target_id, destination_target_id)
            VALUES
            (
              ${sql.join(
                targets.map(dest => sql.join([target, dest], sql`, `)),
                sql`), (`
              )}
            )
            ON CONFLICT (target_id, destination_target_id) DO NOTHING
          `);

          return trx.one(sql`
            UPDATE public.targets as t
            SET validation_percentage = ${percentage}, validation_period = ${period}, validation_excluded_clients = ${sql.array(
            excludedClients,
            'text'
          )}
            FROM (
              SELECT
                it.id,
                array_agg(tv.destination_target_id) as targets
              FROM public.targets AS it
              LEFT JOIN public.target_validation AS tv ON (tv.target_id = it.id)
              WHERE it.id = ${target} AND it.project_id = ${project}
              GROUP BY it.id
              LIMIT 1
            ) ret
            WHERE t.id = ret.id
            RETURNING t.id, t.validation_enabled, t.validation_percentage, t.validation_period, t.validation_excluded_clients, ret.targets;
          `);
        })
      ).validation;
    },
    async hasSchema({ target }) {
      return pool.exists(
        sql`
          SELECT 1 FROM public.versions as v WHERE v.target_id = ${target} LIMIT 1
        `
      );
    },
    async getMaybeLatestValidVersion({ target }) {
      const version = await pool.maybeOne<Slonik<versions & Pick<commits, 'author' | 'service' | 'commit'>>>(
        sql`
          SELECT v.*, c.author, c.service, c.commit FROM public.versions as v 
          LEFT JOIN public.commits as c ON (c.id = v.commit_id)
          WHERE v.target_id = ${target} AND v.valid IS TRUE
          ORDER BY v.created_at DESC
          LIMIT 1
        `
      );

      if (!version) {
        return null;
      }

      return {
        id: version.id,
        valid: version.valid,
        date: version.created_at as any,
        commit: version.commit_id,
        base_schema: version.base_schema,
      };
    },
    async getLatestValidVersion({ target }) {
      const version = await pool.one<Slonik<versions & Pick<commits, 'author' | 'service' | 'commit'>>>(
        sql`
          SELECT v.*, c.author, c.service, c.commit FROM public.versions as v 
          LEFT JOIN public.commits as c ON (c.id = v.commit_id)
          WHERE v.target_id = ${target} AND v.valid IS TRUE
          ORDER BY v.created_at DESC
          LIMIT 1
        `
      );

      return {
        id: version.id,
        valid: version.valid,
        date: version.created_at as any,
        commit: version.commit_id,
        base_schema: version.base_schema,
      };
    },
    async getLatestVersion({ project, target }) {
      const version = await pool.one<Slonik<versions & Pick<commits, 'author' | 'service' | 'commit' | 'created_at'>>>(
        sql`
          SELECT v.*, c.author, c.service, c.commit FROM public.versions as v 
          LEFT JOIN public.commits as c ON (c.id = v.commit_id)
          LEFT JOIN public.targets as t ON (t.id = v.target_id)
          WHERE v.target_id = ${target} AND t.project_id = ${project}
          ORDER BY v.created_at DESC
          LIMIT 1
        `
      );

      return {
        id: version.id,
        valid: version.valid,
        date: version.created_at as any,
        commit: version.commit_id,
        base_schema: version.base_schema,
      };
    },

    async getMaybeLatestVersion({ project, target }) {
      const version = await pool.maybeOne<
        Slonik<versions & Pick<commits, 'author' | 'service' | 'commit' | 'created_at'>>
      >(
        sql`
          SELECT v.*, c.author, c.service, c.commit FROM public.versions as v 
          LEFT JOIN public.commits as c ON (c.id = v.commit_id)
          LEFT JOIN public.targets as t ON (t.id = v.target_id)
          WHERE v.target_id = ${target} AND t.project_id = ${project}
          ORDER BY v.created_at DESC
          LIMIT 1
        `
      );

      if (!version) {
        return null;
      }

      return {
        id: version.id,
        valid: version.valid,
        date: version.created_at as any,
        commit: version.commit_id,
        base_schema: version.base_schema,
      };
    },
    async getLatestSchemas({ organization, project, target }) {
      const latest = await pool.maybeOne<Pick<versions, 'id'>>(sql`
        SELECT v.id FROM public.versions as v
        LEFT JOIN public.targets as t ON (t.id = v.target_id)
        WHERE t.id = ${target} AND t.project_id = ${project}
        ORDER BY v.created_at DESC
        LIMIT 1
      `);

      if (!latest) {
        return {
          schemas: [],
        };
      }

      const schemas = await storage.getSchemasOfVersion({
        version: latest.id,
        organization,
        project,
        target,
      });

      return {
        version: latest.id,
        schemas,
      };
    },
    async getSchemasOfVersion({ version, includeMetadata = false }) {
      const results = await pool.many<
        Slonik<
          WithUrl<
            WithMaybeMetadata<
              Pick<
                commits,
                'id' | 'commit' | 'author' | 'content' | 'created_at' | 'project_id' | 'service' | 'target_id'
              >
            >
          >
        >
      >(
        sql`
          SELECT
            c.id,
            c.commit,
            c.author,
            c.content,
            c.created_at,
            c.project_id,
            c.service,
            c.target_id,
            ${includeMetadata ? sql`c.metadata,` : sql``}
            vc.url
          FROM
            public.version_commit AS vc
              LEFT JOIN
                public.commits AS c 
                  ON c.id = vc.commit_id
          WHERE
            vc.version_id = ${version}
          ORDER BY
            c.created_at DESC
        `
      );

      return results.map(transformSchema);
    },
    async getSchemasOfPreviousVersion({ version, target }) {
      const results = await pool.query<Slonik<WithUrl<commits>>>(
        sql`
          SELECT c.*, vc.url FROM public.version_commit as vc
          LEFT JOIN public.commits as c ON (c.id = vc.commit_id)
          WHERE vc.version_id = (
            SELECT v.id FROM public.versions as v WHERE v.created_at < (
              SELECT vi.created_at FROM public.versions as vi WHERE vi.id = ${version}
            ) AND v.target_id = ${target} ORDER BY v.created_at DESC LIMIT 1
          )
          ORDER BY c.created_at DESC
        `
      );

      return results.rows.map(transformSchema);
    },
    async updateSchemaUrlOfVersion({ version, commit, url }) {
      await pool.query(
        sql`
          UPDATE public.version_commit
          SET url = ${url ?? null}
          WHERE version_id = ${version} AND commit_id = ${commit}
        `
      );
    },

    async updateServiceName({ commit, name }) {
      await pool.query(
        sql`
          UPDATE public.commits
          SET service = ${name ?? null}
          WHERE id = ${commit}
        `
      );
    },

    async getVersion({ project, target, version }) {
      const result = await pool.one<
        Slonik<versions & Pick<commits, 'author' | 'service' | 'commit' | 'created_at'>>
      >(sql`
        SELECT v.*, c.author, c.service, c.commit FROM public.versions as v 
        LEFT JOIN public.commits as c ON (c.id = v.commit_id)
        LEFT JOIN public.targets as t ON (t.id = v.target_id)
        WHERE v.target_id = ${target} AND t.project_id = ${project} AND v.id = ${version} LIMIT 1
      `);

      return {
        id: result.id,
        valid: result.valid,
        date: result.created_at as any,
        commit: result.commit_id,
        base_schema: result.base_schema,
        author: result.author,
        service: result.service,
      };
    },

    async getVersions({ project, target, after, limit }) {
      const query = sql`
      SELECT v.*, c.author, c.service, c.commit FROM public.versions as v 
      LEFT JOIN public.commits as c ON (c.id = v.commit_id)
      LEFT JOIN public.targets as t ON (t.id = v.target_id)
      WHERE v.target_id = ${target} AND t.project_id = ${project} AND v.created_at < ${
        after ? sql`(SELECT va.created_at FROM public.versions as va WHERE va.id = ${after})` : sql`NOW()`
      }
      ORDER BY v.created_at DESC
      LIMIT ${limit + 1}
    `;
      const result = await pool.query<Slonik<versions & Pick<commits, 'author' | 'service' | 'commit' | 'created_at'>>>(
        query
      );

      const hasMore = result.rows.length > limit;

      const versions = result.rows.slice(0, limit).map(version => ({
        id: version.id,
        valid: version.valid,
        date: version.created_at as any,
        commit: version.commit_id,
        base_schema: version.base_schema,
      }));

      return {
        versions,
        hasMore,
      };
    },
    async insertSchema({ schema, commit, author, project, target, service = null, url = null, metadata }) {
      const result = await pool.one<Slonik<commits>>(sql`
        INSERT INTO public.commits
          (
            author,
            service,
            commit,
            content,
            project_id,
            target_id,
            metadata
          )
        VALUES
          (
            ${author},
            ${service}::text,
            ${commit}::text,
            ${schema}::text,
            ${project},
            ${target},
            ${metadata}
          )
        RETURNING *
      `);

      return transformSchema({ ...result, url });
    },
    async createVersion(input) {
      // look for latest version in order to fetch urls of commits associated with that version
      const previousVersion = await pool.maybeOne<Slonik<versions>>(sql`
        SELECT v.id FROM public.versions as v
        LEFT JOIN public.targets as t ON (t.id = v.target_id)
        WHERE t.id = ${input.target} AND t.project_id = ${input.project}
        ORDER BY v.created_at DESC
        LIMIT 1
      `);
      // creates a new version
      const newVersion = await pool.one<Slonik<Pick<versions, 'id' | 'created_at'>>>(sql`
        INSERT INTO public.versions
          (
            valid,
            target_id,
            commit_id,
            base_schema
          )
        VALUES
          (
            ${input.valid},
            ${input.target},
            ${input.commit},
            ${input.base_schema}
          )
        RETURNING
          id,
          created_at
      `);

      // we want to write new url, so fill up the array with provided data
      let commits: Array<{ commit_id: string; url?: string | null }> = [
        {
          commit_id: input.commit,
          url: input.url,
        },
      ];

      if (previousVersion?.id) {
        const vid = previousVersion.id;
        // fetch the rest of commits
        const otherCommits = await pool.many<Pick<version_commit, 'commit_id' | 'url'>>(
          sql`SELECT commit_id, url FROM public.version_commit WHERE version_id = ${vid} AND commit_id != ${input.commit}`
        );

        commits = commits.concat(otherCommits);
      }

      await Promise.all(
        input.commits.map(async cid => {
          await pool.query(sql`
            INSERT INTO public.version_commit
              (version_id, commit_id, url)
            VALUES
            (${newVersion.id}, ${cid}, ${commits.find(c => c.commit_id === cid)?.url || null})
          `);
        })
      );

      return {
        id: newVersion.id,
        date: newVersion.created_at as any,
        url: input.url,
        valid: input.valid,
        commit: input.commit,
        base_schema: input.base_schema,
      };
    },

    async updateVersionStatus({ version, valid }) {
      return transformSchemaVersion(
        await pool.one<Slonik<versions>>(sql`
          UPDATE public.versions
          SET valid = ${valid}
          WHERE id = ${version}
          RETURNING *
        `)
      );
    },

    getSchema: batch(async selectors => {
      const rows = await pool.many<Slonik<WithUrl<commits>>>(
        sql`
            SELECT c.* 
            FROM public.commits as c
            WHERE (c.id, c.target_id) IN ((${sql.join(
              selectors.map(s => sql`${s.commit}, ${s.target}`),
              sql`), (`
            )}))
        `
      );
      const schemas = rows.map(transformSchema);

      return selectors.map(selector => {
        const schema = schemas.find(row => row.id === selector.commit && row.target === selector.target);

        if (schema) {
          return Promise.resolve(schema);
        }

        return Promise.reject(new Error(`Schema not found (commit=${selector.commit}, target=${selector.target})`));
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
        sql`INSERT INTO public.activities (${identifiers}) VALUES (${values}) RETURNING *;`
      );
    },
    async getActivities(selector) {
      let query: TaggedTemplateLiteralInvocationType;
      if ('target' in selector) {
        query = sql`
          SELECT
            jsonb_agg(a.*) as activity,
            jsonb_agg(t.*) as target,
            jsonb_agg(p.*) as project,
            jsonb_agg(o.*) as organization,
            jsonb_agg(u.*) as user
          FROM public.activities as a
          LEFT JOIN public.targets as t ON (t.id = a.target_id)
          LEFT JOIN public.projects as p ON (p.id = a.project_id)
          LEFT JOIN public.organizations as o ON (o.id = a.organization_id)
          LEFT JOIN public.users as u ON (u.id = a.user_id)
          WHERE
            a.target_id = ${selector.target}
            AND a.project_id = ${selector.project}
            AND a.organization_id = ${selector.organization}
          GROUP BY a.created_at
          ORDER BY a.created_at DESC LIMIT ${selector.limit}
        `;
      } else if ('project' in selector) {
        query = sql`
          SELECT
            jsonb_agg(a.*) as activity,
            jsonb_agg(t.*) as target,
            jsonb_agg(p.*) as project,
            jsonb_agg(o.*) as organization,
            jsonb_agg(u.*) as user
          FROM public.activities as a
          LEFT JOIN public.targets as t ON (t.id = a.target_id)
          LEFT JOIN public.projects as p ON (p.id = a.project_id)
          LEFT JOIN public.organizations as o ON (o.id = a.organization_id)
          LEFT JOIN public.users as u ON (u.id = a.user_id)
          WHERE
            a.project_id = ${selector.project}
            AND a.organization_id = ${selector.organization}
          GROUP BY a.created_at
          ORDER BY a.created_at DESC LIMIT ${selector.limit}
        `;
      } else {
        query = sql`
          SELECT
            jsonb_agg(a.*) as activity,
            jsonb_agg(t.*) as target,
            jsonb_agg(p.*) as project,
            jsonb_agg(o.*) as organization,
            jsonb_agg(u.*) as user
          FROM public.activities as a
          LEFT JOIN public.targets as t ON (t.id = a.target_id)
          LEFT JOIN public.projects as p ON (p.id = a.project_id)
          LEFT JOIN public.organizations as o ON (o.id = a.organization_id)
          LEFT JOIN public.users as u ON (u.id = a.user_id)
          WHERE a.organization_id = ${selector.organization}
          GROUP BY a.created_at
          ORDER BY a.created_at DESC LIMIT ${selector.limit}
        `;
      }

      const result = await pool.query<
        Slonik<{
          activity: [activities];
          target: [targets];
          project: [projects];
          organization: [organizations];
          user: [users];
        }>
      >(query);

      return result.rows.map(transformActivity);
    },
    async insertPersistedOperation({ operationHash, project, name, kind, content }) {
      return transformPersistedOperation(
        await pool.one<Slonik<persisted_operations>>(sql`
          INSERT INTO public.persisted_operations
            (operation_hash, operation_name, operation_kind, content, project_id)
          VALUES
            (${operationHash}, ${name}, ${kind}, ${content}, ${project})
          RETURNING *
        `)
      );
    },
    async getPersistedOperations({ project }) {
      const results = await pool.query<Slonik<persisted_operations>>(
        sql`
          SELECT * FROM public.persisted_operations
          WHERE project_id = ${project}
          ORDER BY created_at DESC`
      );

      return results.rows.map(transformPersistedOperation);
    },
    async getSelectedPersistedOperations({ project, hashes }) {
      const results = await pool.query<Slonik<persisted_operations>>(
        sql`
          SELECT * FROM public.persisted_operations
          WHERE project_id = ${project} AND operation_hash IN (${sql.join(hashes, sql`, `)})
          ORDER BY created_at DESC`
      );

      return results.rows.map(transformPersistedOperation);
    },
    async getPersistedOperation({ operation, project }) {
      return transformPersistedOperation(
        await pool.one<Slonik<persisted_operations>>(
          sql`
            SELECT c.* FROM public.persisted_operations as c
            WHERE c.id = ${operation} AND project_id = ${project}`
        )
      );
    },
    async comparePersistedOperations({ project, hashes }) {
      const results = await pool.query<Pick<persisted_operations, 'operation_hash'>>(
        sql`
          SELECT operation_hash FROM public.persisted_operations
          WHERE project_id = ${project} AND operation_hash IN (${sql.join(hashes, sql`, `)})
          ORDER BY created_at DESC`
      );

      return hashes.filter(hash => !results.rows.some(row => row.operation_hash === hash));
    },
    async deletePersistedOperation({ project, operation }) {
      const result = transformPersistedOperation(
        await pool.one<Slonik<persisted_operations>>(
          sql`
            DELETE FROM public.persisted_operations
            WHERE id = ${operation} AND project_id = ${project}
            RETURNING *
          `
        )
      );

      return result;
    },
    async addSlackIntegration({ organization, token }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE public.organizations
          SET slack_token = ${token}
          WHERE id = ${organization}
        `
      );
    },
    async deleteSlackIntegration({ organization }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE public.organizations
          SET slack_token = NULL
          WHERE id = ${organization}
        `
      );
    },
    async getSlackIntegrationToken({ organization }) {
      const result = await pool.maybeOne<Pick<organizations, 'slack_token'>>(
        sql`
          SELECT slack_token
          FROM public.organizations
          WHERE id = ${organization}
        `
      );

      return result?.slack_token;
    },
    async addGitHubIntegration({ organization, installationId }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE public.organizations
          SET github_app_installation_id = ${installationId}
          WHERE id = ${organization}
        `
      );
    },
    async deleteGitHubIntegration({ organization }) {
      await pool.query<Slonik<organizations>>(
        sql`
          UPDATE public.organizations
          SET github_app_installation_id = NULL
          WHERE id = ${organization}
        `
      );
      await pool.query<Slonik<projects>>(
        sql`
          UPDATE public.projects
          SET git_repository = NULL
          WHERE org_id = ${organization}
        `
      );
    },
    async getGitHubIntegrationInstallationId({ organization }) {
      const result = await pool.maybeOne<Pick<organizations, 'github_app_installation_id'>>(
        sql`
          SELECT github_app_installation_id
          FROM public.organizations
          WHERE id = ${organization}
        `
      );

      return result?.github_app_installation_id;
    },
    async addAlertChannel({ project, name, type, slack, webhook }) {
      return transformAlertChannel(
        await pool.one<Slonik<alert_channels>>(
          sql`
            INSERT INTO public.alert_channels
              ("name", "type", "project_id", "slack_channel", "webhook_endpoint")
            VALUES
              (${name}, ${type}, ${project}, ${slack?.channel ?? null}, ${webhook?.endpoint ?? null})
            RETURNING *
          `
        )
      );
    },
    async deleteAlertChannels({ project, channels }) {
      const result = await pool.query<Slonik<alert_channels>>(
        sql`
          DELETE FROM public.alert_channels
          WHERE 
            project_id = ${project} AND 
            id IN (${sql.join(channels, sql`, `)})
          RETURNING *
        `
      );

      return result.rows.map(transformAlertChannel);
    },
    async getAlertChannels({ project }) {
      const result = await pool.query<Slonik<alert_channels>>(
        sql`SELECT * FROM public.alert_channels WHERE project_id = ${project} ORDER BY created_at DESC`
      );

      return result.rows.map(transformAlertChannel);
    },

    async addAlert({ organization, project, target, channel, type }) {
      return transformAlert(
        await pool.one<Slonik<alerts>>(
          sql`
            INSERT INTO public.alerts
              ("type", "alert_channel_id", "target_id", "project_id")
            VALUES
              (${type}, ${channel}, ${target}, ${project})
            RETURNING *
          `
        ),
        organization
      );
    },
    async deleteAlerts({ organization, project, alerts }) {
      const result = await pool.query<Slonik<alerts>>(
        sql`
          DELETE FROM public.alerts
          WHERE 
            project_id = ${project} AND 
            id IN (${sql.join(alerts, sql`, `)})
          RETURNING *
        `
      );

      return result.rows.map(row => transformAlert(row, organization));
    },
    async getAlerts({ organization, project }) {
      const result = await pool.query<Slonik<alerts>>(
        sql`SELECT * FROM public.alerts WHERE project_id = ${project} ORDER BY created_at DESC`
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
          FROM public.targets AS t
          LEFT JOIN public.projects AS p ON (p.id = t.project_id)
          LEFT JOIN public.organizations AS o ON (o.id = p.org_id)
        `
      );
      return results.rows;
    },
    async getGetOrganizationsAndTargetPairsWithLimitInfo() {
      const results = await pool.query<
        Slonik<{
          organization: string;
          org_name: string;
          owner_email: string;
          target: string;
          limit_operations_monthly: number;
          limit_retention_days: number;
        }>
      >(
        sql`
          SELECT 
            o.id as organization,
            o.name as org_name,
            o.limit_operations_monthly,
            o.limit_retention_days,
            t.id as target,
            u.email as owner_email
          FROM public.targets AS t
          LEFT JOIN public.projects AS p ON (p.id = t.project_id)
          LEFT JOIN public.organizations AS o ON (o.id = p.org_id)
          LEFT JOIN public.users AS u ON (u.id = o.user_id)
        `
      );
      return results.rows;
    },
    async adminGetStats(daysLimit?: number | null) {
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
        FROM versions AS v
        LEFT JOIN targets AS t ON (t.id = v.target_id)
        LEFT JOIN projects AS p ON (p.id = t.project_id)
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        ${daysLimit ? sql`WHERE v.created_at > NOW() - (INTERVAL '1 days' * ${daysLimit})` : sql``}
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

      // count persisted operations by organization
      const persistedOperationsResult = pool.query<
        Slonik<
          Pick<organizations, 'id'> & {
            total: number;
          }
        >
      >(sql`
        SELECT
          COUNT(*) as total,
          o.id
        FROM persisted_operations AS po
        LEFT JOIN projects AS p ON (p.id = po.project_id)
        LEFT JOIN organizations AS o ON (o.id = p.org_id)
        ${daysLimit ? sql`WHERE po.created_at > NOW() - (INTERVAL '1 days' * ${daysLimit})` : sql``}
        GROUP by o.id
      `);

      // get organizations data
      const organizationsResult = pool.query<Slonik<organizations>>(sql`
        SELECT * FROM organizations
      `);

      const [versions, users, projects, targets, persistedOperations, organizations] = await Promise.all([
        versionsResult,
        usersResult,
        projectsResult,
        targetsResult,
        persistedOperationsResult,
        organizationsResult,
      ]);

      const rows: Array<{
        organization: Organization;
        versions: number;
        users: number;
        projects: number;
        targets: number;
        persistedOperations: number;
        daysLimit?: number | null;
      }> = [];

      function extractTotal<
        T extends {
          total: number;
          id: string;
        }
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
          persistedOperations: extractTotal(persistedOperations.rows, organization.id),
          daysLimit,
        });
      }

      return rows;
    },
    async getBaseSchema({ project, target }) {
      const data = await pool.maybeOne<Record<string, string>>(
        sql`SELECT base_schema FROM public.targets WHERE id=${target} AND project_id=${project}`
      );
      return data!.base_schema;
    },
    async updateBaseSchema({ project, target }, base) {
      if (base) {
        await pool.query(
          sql`UPDATE public.targets SET base_schema = ${base} WHERE id = ${target} AND project_id = ${project}`
        );
      } else {
        await pool.query(
          sql`UPDATE public.targets SET base_schema = null WHERE id = ${target} AND project_id = ${project}`
        );
      }
    },
    async getBillingParticipants() {
      const results = await pool.query<Slonik<organizations_billing>>(sql`SELECT * FROM public.organizations_billing`);

      return results.rows.map(transformOrganizationBilling);
    },
    async getOrganizationBilling(selector) {
      const results = await pool.query<Slonik<organizations_billing>>(
        sql`SELECT * FROM public.organizations_billing WHERE organization_id = ${selector.organization}`
      );

      const mapped = results.rows.map(transformOrganizationBilling);

      return mapped[0] || null;
    },
    async deleteOrganizationBilling(selector) {
      await pool.query<Slonik<organizations_billing>>(
        sql`DELETE FROM public.organizations_billing
        WHERE organization_id = ${selector.organization}`
      );
    },
    async createOrganizationBilling({ billingEmailAddress, organizationId, externalBillingReference }) {
      return transformOrganizationBilling(
        await pool.one<Slonik<organizations_billing>>(
          sql`
            INSERT INTO public.organizations_billing
              ("organization_id", "external_billing_reference_id", "billing_email_address")
            VALUES
              (${organizationId}, ${externalBillingReference}, ${billingEmailAddress || null})
            RETURNING *
          `
        )
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
        }
      );
    },
  };

  return storage;
}

function isDefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}
