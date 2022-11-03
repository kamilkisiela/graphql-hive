import { Injectable } from 'graphql-modules';
import type { NullableAndPartial } from '../../../shared/helpers';
import type {
  Member,
  Organization,
  PersistedOperation,
  Project,
  Schema,
  SchemaVersion,
  Target,
  User,
  ActivityObject,
  TargetSettings,
  AlertChannel,
  Alert,
  OrganizationBilling,
  OrganizationInvitation,
  OIDCIntegration,
} from '../../../shared/entities';
import type { CustomOrchestratorConfig } from '../../schema/providers/orchestrators/custom';
import type { AddAlertChannelInput, AddAlertInput } from '../../../__generated__/types';
import type { OrganizationAccessScope } from '../../auth/providers/organization-access';
import type { ProjectAccessScope } from '../../auth/providers/project-access';
import type { TargetAccessScope } from '../../auth/providers/target-access';

type Paginated<T> = T & {
  after?: string | null;
  limit: number;
};

export interface OrganizationSelector {
  organization: string;
}

export interface ProjectSelector extends OrganizationSelector {
  project: string;
}

export interface TargetSelector extends ProjectSelector {
  target: string;
}

export interface PersistedOperationSelector extends ProjectSelector {
  operation: string;
}

export interface Storage {
  destroy(): Promise<void>;
  ensureUserExists(_: {
    superTokensUserId: string;
    externalAuthUserId?: string | null;
    email: string;
    reservedOrgNames: string[];
    scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    oidcIntegration: null | {
      id: string;
      defaultScopes: Array<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    };
  }): Promise<'created' | 'no_action'>;

  getUserBySuperTokenId(_: { superTokensUserId: string }): Promise<User | null>;
  setSuperTokensUserId(_: { auth0UserId: string; superTokensUserId: string; externalUserId: string }): Promise<void>;
  getUserWithoutAssociatedSuperTokenIdByAuth0Email(_: { email: string }): Promise<User | null>;
  getUserById(_: { id: string }): Promise<User | null>;

  updateUser(_: { id: string; fullName: string; displayName: string }): Promise<User | never>;

  getOrganizationId(_: OrganizationSelector): Promise<string | never>;
  getOrganizationByInviteCode(_: { inviteCode: string }): Promise<Organization | null>;
  getOrganizationByCleanId(_: { cleanId: string }): Promise<Organization | null>;
  getOrganizationByGitHubInstallationId(_: { installationId: string }): Promise<Organization | null>;
  getOrganization(_: OrganizationSelector): Promise<Organization | never>;
  getMyOrganization(_: { user: string }): Promise<Organization | null>;
  getOrganizations(_: { user: string }): Promise<readonly Organization[] | never>;
  createOrganization(
    _: Pick<Organization, 'cleanId' | 'name' | 'type'> & {
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
      reservedNames: string[];
    }
  ): Promise<Organization | never>;
  deleteOrganization(_: OrganizationSelector): Promise<Organization | never>;
  updateOrganizationName(
    _: OrganizationSelector & Pick<Organization, 'name' | 'cleanId'> & { user: string }
  ): Promise<Organization | never>;
  updateOrganizationPlan(_: OrganizationSelector & Pick<Organization, 'billingPlan'>): Promise<Organization | never>;
  updateOrganizationRateLimits(
    _: OrganizationSelector & Pick<Organization, 'monthlyRateLimit'>
  ): Promise<Organization | never>;
  createOrganizationInvitation(_: OrganizationSelector & { email: string }): Promise<OrganizationInvitation | never>;
  deleteOrganizationInvitationByEmail(
    _: OrganizationSelector & { email: string }
  ): Promise<OrganizationInvitation | null>;

  getOrganizationMembers(_: OrganizationSelector): Promise<readonly Member[] | never>;
  getOrganizationInvitations(_: OrganizationSelector): Promise<readonly OrganizationInvitation[]>;
  getOrganizationOwner(_: OrganizationSelector): Promise<Member | never>;
  getOrganizationOwner(_: OrganizationSelector): Promise<Member | never>;
  getOrganizationMember(_: OrganizationSelector & { user: string }): Promise<Member | never>;
  getOrganizationMemberAccessPairs(
    _: readonly (OrganizationSelector & { user: string })[]
  ): Promise<ReadonlyArray<ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>>>;
  hasOrganizationMemberPairs(_: readonly (OrganizationSelector & { user: string })[]): Promise<readonly boolean[]>;
  hasOrganizationProjectMemberPairs(_: readonly (ProjectSelector & { user: string })[]): Promise<readonly boolean[]>;
  addOrganizationMemberViaInvitationCode(
    _: OrganizationSelector & {
      code: string;
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    }
  ): Promise<void>;
  deleteOrganizationMembers(_: OrganizationSelector & { users: readonly string[] }): Promise<void>;
  updateOrganizationMemberAccess(
    _: OrganizationSelector & {
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    }
  ): Promise<void>;

  getPersistedOperationId(_: PersistedOperationSelector): Promise<string | never>;

  getProject(_: ProjectSelector): Promise<Project | never>;
  getProjectId(_: ProjectSelector): Promise<string | never>;
  getProjectByCleanId(_: { cleanId: string } & OrganizationSelector): Promise<Project | null>;
  getProjects(_: OrganizationSelector): Promise<Project[] | never>;
  createProject(
    _: Pick<Project, 'name' | 'cleanId' | 'type'> & NullableAndPartial<CustomOrchestratorConfig> & OrganizationSelector
  ): Promise<Project | never>;
  deleteProject(_: ProjectSelector): Promise<Project | never>;
  updateProjectName(
    _: ProjectSelector & Pick<Project, 'name' | 'cleanId'> & { user: string }
  ): Promise<Project | never>;
  updateProjectGitRepository(_: ProjectSelector & Pick<Project, 'gitRepository'>): Promise<Project | never>;
  enableExternalSchemaComposition(
    _: ProjectSelector & {
      endpoint: string;
      encryptedSecret: string;
    }
  ): Promise<Project>;
  disableExternalSchemaComposition(_: ProjectSelector): Promise<Project>;

  getTargetId(_: TargetSelector & { useIds?: boolean }): Promise<string | never>;
  getTargetByCleanId(
    _: {
      cleanId: string;
    } & ProjectSelector
  ): Promise<Target | null>;
  createTarget(_: Pick<Target, 'cleanId' | 'name'> & ProjectSelector): Promise<Target | never>;
  updateTargetName(_: TargetSelector & Pick<Project, 'name' | 'cleanId'> & { user: string }): Promise<Target | never>;
  deleteTarget(_: TargetSelector): Promise<Target | never>;
  getTarget(_: TargetSelector): Promise<Target | never>;
  getTargets(_: ProjectSelector): Promise<readonly Target[]>;
  getTargetIdsOfOrganization(_: OrganizationSelector): Promise<readonly string[]>;
  getTargetSettings(_: TargetSelector): Promise<TargetSettings | never>;
  setTargetValidation(_: TargetSelector & { enabled: boolean }): Promise<TargetSettings['validation'] | never>;
  updateTargetValidationSettings(
    _: TargetSelector & Omit<TargetSettings['validation'], 'enabled'>
  ): Promise<TargetSettings['validation'] | never>;

  hasSchema(_: TargetSelector): Promise<boolean>;
  getLatestSchemas(
    _: {
      version?: string;
    } & TargetSelector
  ): Promise<
    | {
        schemas: Schema[];
        version?: string;
      }
    | never
  >;
  getLatestValidVersion(_: TargetSelector): Promise<SchemaVersion | never>;
  getMaybeLatestValidVersion(_: TargetSelector): Promise<SchemaVersion | null | never>;
  getLatestVersion(_: TargetSelector): Promise<SchemaVersion | never>;
  getMaybeLatestVersion(_: TargetSelector): Promise<SchemaVersion | null>;

  getSchemasOfVersion(
    _: {
      version: string;
      includeMetadata?: boolean;
    } & TargetSelector
  ): Promise<Schema[] | never>;
  getSchemasOfPreviousVersion(
    _: {
      version: string;
    } & TargetSelector
  ): Promise<readonly Schema[] | never>;
  getVersions(_: Paginated<TargetSelector>): Promise<
    | {
        versions: readonly SchemaVersion[];
        hasMore: boolean;
      }
    | never
  >;
  getVersion(_: TargetSelector & { version: string }): Promise<SchemaVersion | never>;

  updateSchemaUrlOfVersion(_: TargetSelector & { version: string; url?: string | null; commit: string }): Promise<void>;
  updateServiceName(_: TargetSelector & { commit: string; name: string }): Promise<void>;

  insertSchema(
    _: {
      schema: string;
      commit: string;
      author: string;
      service?: string | null;
      url?: string | null;
      metadata: string | null;
    } & TargetSelector
  ): Promise<Schema | never>;

  createVersion(
    _: {
      valid: boolean;
      url?: string | null;
      commit: string;
      commits: string[];
      base_schema: string | null;
    } & TargetSelector
  ): Promise<SchemaVersion | never>;

  updateVersionStatus(
    _: {
      valid: boolean;
      version: string;
    } & TargetSelector
  ): Promise<SchemaVersion | never>;

  getSchema(_: { commit: string; target: string }): Promise<Schema | never>;

  createActivity(
    _: {
      user: string;
      type: string;
      meta: object;
    } & OrganizationSelector &
      Partial<Pick<TargetSelector, 'project' | 'target'>>
  ): Promise<void>;

  getActivities(
    _: (OrganizationSelector | ProjectSelector | TargetSelector) & {
      limit: number;
    }
  ): Promise<readonly ActivityObject[]>;

  getPersistedOperations(_: ProjectSelector): Promise<readonly PersistedOperation[]>;

  getSelectedPersistedOperations(
    _: ProjectSelector & { hashes: readonly string[] }
  ): Promise<readonly PersistedOperation[]>;

  comparePersistedOperations(
    _: ProjectSelector & {
      hashes: readonly string[];
    }
  ): Promise<readonly string[]>;

  getPersistedOperation(_: PersistedOperationSelector): Promise<PersistedOperation | never>;

  insertPersistedOperation(
    _: {
      operationHash: string;
      name: string;
      kind: string;
      content: string;
    } & ProjectSelector
  ): Promise<PersistedOperation | never>;

  deletePersistedOperation(_: PersistedOperationSelector): Promise<PersistedOperation | never>;

  addSlackIntegration(_: OrganizationSelector & { token: string }): Promise<void>;
  deleteSlackIntegration(_: OrganizationSelector): Promise<void>;
  getSlackIntegrationToken(_: OrganizationSelector): Promise<string | null | undefined>;

  addGitHubIntegration(_: OrganizationSelector & { installationId: string }): Promise<void>;
  deleteGitHubIntegration(_: OrganizationSelector): Promise<void>;
  getGitHubIntegrationInstallationId(_: OrganizationSelector): Promise<string | null | undefined>;

  addAlertChannel(_: AddAlertChannelInput): Promise<AlertChannel>;
  deleteAlertChannels(
    _: ProjectSelector & {
      channels: readonly string[];
    }
  ): Promise<readonly AlertChannel[]>;
  getAlertChannels(_: ProjectSelector): Promise<readonly AlertChannel[]>;

  addAlert(_: AddAlertInput): Promise<Alert>;
  deleteAlerts(
    _: ProjectSelector & {
      alerts: readonly string[];
    }
  ): Promise<readonly Alert[]>;
  getAlerts(_: ProjectSelector): Promise<readonly Alert[]>;

  adminGetStats(daysLimit?: number | null): Promise<
    ReadonlyArray<{
      organization: Organization;
      versions: number;
      users: number;
      projects: number;
      targets: number;
      persistedOperations: number;
      daysLimit?: number | null;
    }>
  >;

  adminGetOrganizationsTargetPairs(): Promise<
    ReadonlyArray<{
      organization: string;
      target: string;
    }>
  >;

  getGetOrganizationsAndTargetPairsWithLimitInfo(): Promise<
    ReadonlyArray<{
      organization: string;
      org_name: string;
      org_clean_id: string;
      owner_email: string;
      target: string;
      limit_operations_monthly: number;
      limit_retention_days: number;
    }>
  >;

  getBillingParticipants(): Promise<ReadonlyArray<OrganizationBilling>>;
  getOrganizationBilling(_: OrganizationSelector): Promise<OrganizationBilling | null>;
  deleteOrganizationBilling(_: OrganizationSelector): Promise<void>;

  createOrganizationBilling(_: OrganizationBilling): Promise<OrganizationBilling>;

  getBaseSchema(_: TargetSelector): Promise<string | null>;
  updateBaseSchema(_: TargetSelector, base: string | null): Promise<void>;

  completeGetStartedStep(
    _: OrganizationSelector & {
      step: Exclude<keyof Organization['getStarted'], 'id'>;
    }
  ): Promise<void>;

  getOIDCIntegrationForOrganization(_: { organizationId: string }): Promise<OIDCIntegration | null>;
  getOIDCIntegrationById(_: { oidcIntegrationId: string }): Promise<OIDCIntegration | null>;
  createOIDCIntegrationForOrganization(_: {
    organizationId: string;
    clientId: string;
    encryptedClientSecret: string;
    oauthApiUrl: string;
  }): Promise<{ type: 'ok'; oidcIntegration: OIDCIntegration } | { type: 'error'; reason: string }>;
  updateOIDCIntegration(_: {
    oidcIntegrationId: string;
    clientId: string | null;
    encryptedClientSecret: string | null;
    oauthApiUrl: string | null;
  }): Promise<OIDCIntegration>;
  deleteOIDCIntegration(_: { oidcIntegrationId: string }): Promise<void>;
}

@Injectable()
export class Storage implements Storage {}
