import { Injectable } from 'graphql-modules';
import { Change } from '@graphql-inspector/core';
import type { PolicyConfigurationObject } from '@hive/policy';
import type {
  SchemaCheck,
  SchemaCheckInput,
  SchemaCompositionError,
  TargetBreadcrumb,
} from '@hive/storage';
import type {
  AddAlertChannelInput,
  AddAlertInput,
  RegistryModel,
  SchemaChecksFilter,
} from '../../../__generated__/types';
import type {
  ActivityObject,
  Alert,
  AlertChannel,
  CDNAccessToken,
  DeletedCompositeSchema,
  DocumentCollection,
  DocumentCollectionOperation,
  Member,
  OIDCIntegration,
  Organization,
  OrganizationBilling,
  OrganizationInvitation,
  PaginatedDocumentCollectionOperations,
  PaginatedDocumentCollections,
  PersistedOperation,
  Project,
  Schema,
  SchemaLog,
  SchemaPolicy,
  SchemaVersion,
  Target,
  TargetSettings,
  User,
} from '../../../shared/entities';
import type { OrganizationAccessScope } from '../../auth/providers/organization-access';
import type { ProjectAccessScope } from '../../auth/providers/project-access';
import type { TargetAccessScope } from '../../auth/providers/target-access';
import { SerializableChange } from '../../schema/schema-change-from-meta';

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
  isReady(): Promise<boolean>;
  ensureUserExists(_: {
    superTokensUserId: string;
    externalAuthUserId?: string | null;
    email: string;
    oidcIntegration: null | {
      id: string;
      defaultScopes: Array<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    };
  }): Promise<'created' | 'no_action'>;

  getUserBySuperTokenId(_: { superTokensUserId: string }): Promise<User | null>;
  setSuperTokensUserId(_: {
    auth0UserId: string;
    superTokensUserId: string;
    externalUserId: string;
  }): Promise<void>;
  getUserWithoutAssociatedSuperTokenIdByAuth0Email(_: { email: string }): Promise<User | null>;
  getUserById(_: { id: string }): Promise<User | null>;

  updateUser(_: { id: string; fullName: string; displayName: string }): Promise<User | never>;

  getOrganizationId(_: OrganizationSelector): Promise<string | never>;
  getOrganizationByInviteCode(_: { inviteCode: string }): Promise<Organization | null>;
  getOrganizationByCleanId(_: { cleanId: string }): Promise<Organization | null>;
  getOrganizationByGitHubInstallationId(_: {
    installationId: string;
  }): Promise<Organization | null>;
  getOrganization(_: OrganizationSelector): Promise<Organization | never>;
  getMyOrganization(_: { user: string }): Promise<Organization | null>;
  getOrganizations(_: { user: string }): Promise<readonly Organization[] | never>;
  createOrganization(
    _: Pick<Organization, 'cleanId' | 'name'> & {
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
      reservedNames: string[];
    },
  ): Promise<Organization | never>;

  deleteOrganization(_: OrganizationSelector): Promise<
    | (Organization & {
        tokens: string[];
      })
    | never
  >;

  updateOrganizationName(
    _: OrganizationSelector & Pick<Organization, 'name' | 'cleanId'> & { user: string },
  ): Promise<Organization | never>;

  updateOrganizationPlan(
    _: OrganizationSelector & Pick<Organization, 'billingPlan'>,
  ): Promise<Organization | never>;

  updateOrganizationRateLimits(
    _: OrganizationSelector & Pick<Organization, 'monthlyRateLimit'>,
  ): Promise<Organization | never>;

  createOrganizationInvitation(
    _: OrganizationSelector & { email: string },
  ): Promise<OrganizationInvitation | never>;

  deleteOrganizationInvitationByEmail(
    _: OrganizationSelector & { email: string },
  ): Promise<OrganizationInvitation | null>;

  createOrganizationTransferRequest(
    _: OrganizationSelector & {
      user: string;
    },
  ): Promise<{
    code: string;
  }>;

  getOrganizationTransferRequest(
    _: OrganizationSelector & {
      code: string;
      user: string;
    },
  ): Promise<{
    code: string;
  } | null>;

  answerOrganizationTransferRequest(
    _: OrganizationSelector & {
      code: string;
      user: string;
      accept: boolean;
      oldAdminAccessScopes: ReadonlyArray<
        OrganizationAccessScope | ProjectAccessScope | TargetAccessScope
      >;
    },
  ): Promise<void>;

  getOrganizationMembers(_: OrganizationSelector): Promise<readonly Member[] | never>;
  countOrganizationMembers(_: OrganizationSelector): Promise<number>;

  getOrganizationInvitations(_: OrganizationSelector): Promise<readonly OrganizationInvitation[]>;

  getOrganizationOwnerId(_: OrganizationSelector): Promise<string | null>;

  getOrganizationOwner(_: OrganizationSelector): Promise<Member | never>;

  getOrganizationMember(_: OrganizationSelector & { user: string }): Promise<Member | null>;

  getOrganizationMemberAccessPairs(
    _: readonly (OrganizationSelector & { user: string })[],
  ): Promise<
    ReadonlyArray<ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>>
  >;

  hasOrganizationMemberPairs(
    _: readonly (OrganizationSelector & { user: string })[],
  ): Promise<readonly boolean[]>;

  hasOrganizationProjectMemberPairs(
    _: readonly (ProjectSelector & { user: string })[],
  ): Promise<readonly boolean[]>;

  addOrganizationMemberViaInvitationCode(
    _: OrganizationSelector & {
      code: string;
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    },
  ): Promise<void>;

  deleteOrganizationMembers(_: OrganizationSelector & { users: readonly string[] }): Promise<void>;

  updateOrganizationMemberAccess(
    _: OrganizationSelector & {
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    },
  ): Promise<void>;

  getPersistedOperationId(_: PersistedOperationSelector): Promise<string | never>;

  getProject(_: ProjectSelector): Promise<Project | never>;

  getProjectId(_: ProjectSelector): Promise<string | never>;

  getProjectByCleanId(_: { cleanId: string } & OrganizationSelector): Promise<Project | null>;

  getProjects(_: OrganizationSelector): Promise<Project[] | never>;

  createProject(
    _: Pick<Project, 'name' | 'cleanId' | 'type'> & OrganizationSelector,
  ): Promise<Project | never>;

  deleteProject(_: ProjectSelector): Promise<
    | (Project & {
        tokens: string[];
      })
    | never
  >;

  updateProjectName(
    _: ProjectSelector & Pick<Project, 'name' | 'cleanId'> & { user: string },
  ): Promise<Project | never>;

  enableExternalSchemaComposition(
    _: ProjectSelector & {
      endpoint: string;
      encryptedSecret: string;
    },
  ): Promise<Project>;

  disableExternalSchemaComposition(_: ProjectSelector): Promise<Project>;

  enableProjectNameInGithubCheck(_: ProjectSelector): Promise<Project>;

  updateProjectRegistryModel(
    _: ProjectSelector & {
      model: RegistryModel;
    },
  ): Promise<Project>;

  getTargetId(_: TargetSelector & { useIds?: boolean }): Promise<string | never>;

  getTargetByCleanId(
    _: {
      cleanId: string;
    } & ProjectSelector,
  ): Promise<Target | null>;

  createTarget(_: Pick<Target, 'cleanId' | 'name'> & ProjectSelector): Promise<Target | never>;

  updateTargetName(
    _: TargetSelector & Pick<Project, 'name' | 'cleanId'> & { user: string },
  ): Promise<Target | never>;

  updateTargetGraphQLEndpointUrl(_: {
    targetId: string;
    organizationId: string;
    graphqlEndpointUrl: string | null;
  }): Promise<Target | null>;

  deleteTarget(_: TargetSelector): Promise<
    | (Target & {
        tokens: string[];
      })
    | never
  >;

  getTarget(_: TargetSelector): Promise<Target | never>;

  getTargets(_: ProjectSelector): Promise<readonly Target[]>;

  getTargetIdsOfOrganization(_: OrganizationSelector): Promise<readonly string[]>;
  getTargetIdsOfProject(_: ProjectSelector): Promise<readonly string[]>;
  getTargetSettings(_: TargetSelector): Promise<TargetSettings | never>;

  setTargetValidation(
    _: TargetSelector & { enabled: boolean },
  ): Promise<TargetSettings['validation'] | never>;

  updateTargetValidationSettings(
    _: TargetSelector & Omit<TargetSettings['validation'], 'enabled'>,
  ): Promise<TargetSettings['validation'] | never>;

  countSchemaVersionsOfProject(
    _: ProjectSelector & {
      period: {
        from: Date;
        to: Date;
      } | null;
    },
  ): Promise<number>;
  countSchemaVersionsOfTarget(
    _: TargetSelector & {
      period: {
        from: Date;
        to: Date;
      } | null;
    },
  ): Promise<number>;

  hasSchema(_: TargetSelector): Promise<boolean>;

  getLatestSchemas(
    _: {
      onlyComposable?: boolean;
    } & TargetSelector,
  ): Promise<{
    schemas: Schema[];
    version: string;
    valid: boolean;
  } | null>;

  getLatestValidVersion(_: TargetSelector): Promise<SchemaVersion | never>;

  getMaybeLatestValidVersion(_: TargetSelector): Promise<SchemaVersion | null | never>;

  getLatestVersion(_: TargetSelector): Promise<SchemaVersion | never>;

  getMaybeLatestVersion(_: TargetSelector): Promise<SchemaVersion | null>;

  /**
   * Find a specific schema version via it's action id.
   * The action id is the id of the action that created the schema version, it is user provided.
   * Multiple entries with the same action ID can exist. In that case the latest one is returned.
   */
  getSchemaVersionByActionId(_: {
    targetId: string;
    projectId: string;
    actionId: string;
  }): Promise<SchemaVersion | null>;
  getMatchingServiceSchemaOfVersions(versions: {
    before: string | null;
    after: string;
  }): Promise<null | {
    serviceName: string;
    before: string | null;
    after: string | null;
  }>;
  getSchemasOfVersion(
    _: {
      version: string;
      includeMetadata?: boolean;
    } & TargetSelector,
  ): Promise<Schema[]>;
  getSchemasOfPreviousVersion(
    _: {
      version: string;
      onlyComposable: boolean;
    } & TargetSelector,
  ): Promise<
    | {
        schemas: readonly Schema[];
        id?: string;
      }
    | never
  >;
  getVersions(_: Paginated<TargetSelector>): Promise<
    | {
        versions: readonly SchemaVersion[];
        hasMore: boolean;
      }
    | never
  >;

  getVersion(_: TargetSelector & { version: string }): Promise<SchemaVersion | never>;
  deleteSchema(
    _: {
      serviceName: string;
      composable: boolean;
      actionFn(): Promise<void>;
      changes: Array<Change> | null;
    } & TargetSelector &
      (
        | {
            compositeSchemaSDL: null;
            supergraphSDL: null;
            schemaCompositionErrors: Array<SchemaCompositionError>;
          }
        | {
            compositeSchemaSDL: string;
            supergraphSDL: string | null;
            schemaCompositionErrors: null;
          }
      ),
  ): Promise<DeletedCompositeSchema>;

  createVersion(
    _: ({
      schema: string;
      author: string;
      service?: string | null;
      metadata: string | null;
      valid: boolean;
      url?: string | null;
      commit: string;
      logIds: string[];
      base_schema: string | null;
      actionFn(): Promise<void>;
      changes: Array<Change>;
      previousSchemaVersion: null | string;
      github: null | {
        repository: string;
        sha: string;
      };
    } & TargetSelector) &
      (
        | {
            compositeSchemaSDL: null;
            supergraphSDL: null;
            schemaCompositionErrors: Array<SchemaCompositionError>;
          }
        | {
            compositeSchemaSDL: string;
            supergraphSDL: string | null;
            schemaCompositionErrors: null;
          }
      ),
  ): Promise<SchemaVersion | never>;

  /**
   * Returns the changes between the given version and the previous version.
   * If it return `null` the schema version does not have any changes persisted.
   * This can happen if the schema version was created before we introduced persisting changes.
   */
  getSchemaChangesForVersion(_: { versionId: string }): Promise<null | Array<SerializableChange>>;

  updateVersionStatus(
    _: {
      valid: boolean;
      version: string;
    } & TargetSelector,
  ): Promise<SchemaVersion | never>;

  getSchemaLog(_: { commit: string; target: string }): Promise<SchemaLog>;

  createActivity(
    _: {
      user: string;
      type: string;
      meta: object;
    } & OrganizationSelector &
      Partial<Pick<TargetSelector, 'project' | 'target'>>,
  ): Promise<void>;

  getActivities(
    _: (OrganizationSelector | ProjectSelector | TargetSelector) & {
      limit: number;
    },
  ): Promise<readonly ActivityObject[]>;

  getPersistedOperations(_: ProjectSelector): Promise<readonly PersistedOperation[]>;

  getSelectedPersistedOperations(
    _: ProjectSelector & { hashes: readonly string[] },
  ): Promise<readonly PersistedOperation[]>;

  comparePersistedOperations(
    _: ProjectSelector & {
      hashes: readonly string[];
    },
  ): Promise<readonly string[]>;

  getPersistedOperation(_: PersistedOperationSelector): Promise<PersistedOperation | never>;

  insertPersistedOperation(
    _: {
      operationHash: string;
      name: string;
      kind: string;
      content: string;
    } & ProjectSelector,
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
    },
  ): Promise<readonly AlertChannel[]>;

  getAlertChannels(_: ProjectSelector): Promise<readonly AlertChannel[]>;

  addAlert(_: AddAlertInput): Promise<Alert>;

  deleteAlerts(
    _: ProjectSelector & {
      alerts: readonly string[];
    },
  ): Promise<readonly Alert[]>;

  getAlerts(_: ProjectSelector): Promise<readonly Alert[]>;

  adminGetStats(period: { from: Date; to: Date }): Promise<
    ReadonlyArray<{
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
      org_plan_name: string;
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
    },
  ): Promise<void>;

  getOIDCIntegrationForOrganization(_: { organizationId: string }): Promise<OIDCIntegration | null>;

  getOIDCIntegrationById(_: { oidcIntegrationId: string }): Promise<OIDCIntegration | null>;

  createOIDCIntegrationForOrganization(_: {
    organizationId: string;
    clientId: string;
    encryptedClientSecret: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    authorizationEndpoint: string;
  }): Promise<{ type: 'ok'; oidcIntegration: OIDCIntegration } | { type: 'error'; reason: string }>;

  updateOIDCIntegration(_: {
    oidcIntegrationId: string;
    clientId: string | null;
    encryptedClientSecret: string | null;
    tokenEndpoint: string | null;
    userinfoEndpoint: string | null;
    authorizationEndpoint: string | null;
  }): Promise<OIDCIntegration>;

  deleteOIDCIntegration(_: { oidcIntegrationId: string }): Promise<void>;

  createCDNAccessToken(_: {
    id: string;
    targetId: string;
    s3Key: string;
    firstCharacters: string;
    lastCharacters: string;
    alias: string;
  }): Promise<CDNAccessToken | null>;

  getCDNAccessTokenById(_: { cdnAccessTokenId: string }): Promise<CDNAccessToken | null>;

  deleteCDNAccessToken(_: { cdnAccessTokenId: string }): Promise<boolean>;

  getPaginatedCDNAccessTokensForTarget(_: {
    targetId: string;
    first: number | null;
    cursor: null | string;
  }): Promise<
    Readonly<{
      items: ReadonlyArray<{
        node: CDNAccessToken;
        cursor: string;
      }>;
      pageInfo: Readonly<{
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
      }>;
    }>
  >;

  /** Schema Policies */
  setSchemaPolicyForOrganization(input: {
    organizationId: string;
    policy: PolicyConfigurationObject;
    allowOverrides: boolean;
  }): Promise<SchemaPolicy>;
  setSchemaPolicyForProject(input: {
    projectId: string;
    policy: PolicyConfigurationObject;
  }): Promise<SchemaPolicy>;
  findInheritedPolicies(selector: ProjectSelector): Promise<SchemaPolicy[]>;
  getSchemaPolicyForOrganization(organizationId: string): Promise<SchemaPolicy | null>;
  getSchemaPolicyForProject(projectId: string): Promise<SchemaPolicy | null>;

  /** Document Collections */
  getPaginatedDocumentCollectionsForTarget(_: {
    targetId: string;
    first: number | null;
    cursor: null | string;
  }): Promise<PaginatedDocumentCollections>;

  createDocumentCollection(_: {
    targetId: string;
    title: string;
    description: string;
    createdByUserId: string | null;
  }): Promise<DocumentCollection>;

  /**
   * Returns null if the document collection does not exist (did not get deleted).
   * Returns the id of the deleted document collection if it got deleted
   */
  deleteDocumentCollection(_: { documentCollectionId: string }): Promise<string | null>;

  /**
   * Returns null if the document collection does not exist (did not get updated).
   */
  updateDocumentCollection(_: {
    documentCollectionId: string;
    title: string | null;
    description: string | null;
  }): Promise<DocumentCollection | null>;

  getDocumentCollection(_: { id: string }): Promise<DocumentCollection | null>;

  getPaginatedDocumentsForDocumentCollection(_: {
    documentCollectionId: string;
    first: number | null;
    cursor: null | string;
  }): Promise<PaginatedDocumentCollectionOperations>;

  createDocumentCollectionDocument(_: {
    documentCollectionId: string;
    title: string;
    contents: string;
    variables: string | null;
    headers: string | null;
    createdByUserId: string | null;
  }): Promise<DocumentCollectionOperation>;

  /**
   * Returns null if the document collection document does not exist (did not get deleted).
   * Returns the id of the deleted document collection document if it got deleted
   */
  deleteDocumentCollectionDocument(_: {
    documentCollectionDocumentId: string;
  }): Promise<string | null>;

  /**
   * Returns null if the document collection document does not exist (did not get updated).
   */
  updateDocumentCollectionDocument(_: {
    documentCollectionDocumentId: string;
    title: string | null;
    contents: string | null;
    variables: string | null;
    headers: string | null;
  }): Promise<DocumentCollectionOperation | null>;

  getDocumentCollectionDocument(_: { id: string }): Promise<DocumentCollectionOperation | null>;
  /**
   * Persist a schema check record in the database.
   */
  createSchemaCheck(_: SchemaCheckInput & { expiresAt: Date | null }): Promise<SchemaCheck>;
  /**
   * Delete the expired schema checks from the database.
   */
  purgeExpiredSchemaChecks(_: { expiresAt: Date }): Promise<number>;
  /**
   * Find schema check for a given ID and target.
   */
  findSchemaCheck(input: { schemaCheckId: string; targetId: string }): Promise<SchemaCheck | null>;
  /**
   * Retrieve paginated schema checks for a given target.
   */
  getPaginatedSchemaChecksForTarget<TransformedSchemaCheck extends SchemaCheck = SchemaCheck>(_: {
    first: number | null;
    cursor: null | string;
    targetId: string;
    /**
     * Optional mapper for transforming the raw schema check loaded from the database.
     */
    transformNode?: (check: SchemaCheck) => TransformedSchemaCheck;
    /**
     * Optional filters config for filtering failed and/or changed schema checks.
     */
    filters?: SchemaChecksFilter | null;
  }): Promise<
    Readonly<{
      items: ReadonlyArray<{
        node: TransformedSchemaCheck;
        cursor: string;
      }>;
      pageInfo: Readonly<{
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
      }>;
    }>
  >;
  /**
   * Set the github check run id for a schema check.
   */
  setSchemaCheckGithubCheckRunId(input: {
    schemaCheckId: string;
    githubCheckRunId: number;
  }): Promise<SchemaCheck | null>;
  /**
   * Overwrite and approve a schema check.
   */
  approveFailedSchemaCheck(input: {
    schemaCheckId: string;
    userId: string;
  }): Promise<SchemaCheck | null>;

  getTargetBreadcrumbForTargetId(_: { targetId: string }): Promise<TargetBreadcrumb | null>;

  /**
   * Get an user that belongs to a specific organization by id.
   */
  getOrganizationUser(_: { organizationId: string; userId: string }): Promise<User | null>;

  // Zendesk
  setZendeskUserId(_: { userId: string; zendeskId: string }): Promise<void>;
  setZendeskOrganizationId(_: { organizationId: string; zendeskId: string }): Promise<void>;
  setZendeskOrganizationUserConnection(_: {
    userId: string;
    organizationId: string;
  }): Promise<void>;
}

@Injectable()
export class Storage implements Storage {}
