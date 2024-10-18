import { Injectable } from 'graphql-modules';
import type { DatabasePool } from 'slonik';
import type { PolicyConfigurationObject } from '@hive/policy';
import type {
  ConditionalBreakingChangeMetadata,
  PaginatedSchemaVersionConnection,
  SchemaChangeType,
  SchemaCheck,
  SchemaCheckInput,
  SchemaCompositionError,
  SchemaVersion,
  TargetBreadcrumb,
} from '@hive/storage';
import type {
  AddAlertChannelInput,
  AddAlertInput,
  RegistryModel,
  SchemaChecksFilter,
} from '../../../__generated__/types';
import type {
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
  OrganizationMemberRole,
  PaginatedDocumentCollectionOperations,
  PaginatedDocumentCollections,
  PreflightScript,
  Project,
  Schema,
  SchemaLog,
  SchemaPolicy,
  Target,
  TargetSettings,
  User,
} from '../../../shared/entities';
import type { OrganizationAccessScope } from '../../auth/providers/organization-access';
import type { ProjectAccessScope } from '../../auth/providers/project-access';
import type { TargetAccessScope } from '../../auth/providers/target-access';
import type { Contracts } from '../../schema/providers/contracts';
import type { SchemaCoordinatesDiffResult } from '../../schema/providers/inspector';

export interface OrganizationSelector {
  organization: string;
}

export interface ProjectSelector extends OrganizationSelector {
  project: string;
}

export interface TargetSelector extends ProjectSelector {
  target: string;
}

type CreateContractVersionInput = {
  contractId: string;
  contractName: string;
  compositeSchemaSDL: string | null;
  supergraphSDL: string | null;
  schemaCompositionErrors: Array<SchemaCompositionError> | null;
  changes: null | Array<SchemaChangeType>;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Storage {
  pool: DatabasePool;
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
    firstName: string | null;
    lastName: string | null;
  }): Promise<'created' | 'no_action'>;

  getUserBySuperTokenId(_: { superTokensUserId: string }): Promise<User | null>;
  getUserById(_: { id: string }): Promise<User | null>;

  updateUser(_: { id: string; fullName: string; displayName: string }): Promise<User | never>;

  getOrganizationId(_: OrganizationSelector): Promise<string | null>;
  getOrganizationByInviteCode(_: { inviteCode: string }): Promise<Organization | null>;
  getOrganizationByCleanId(_: { cleanId: string }): Promise<Organization | null>;
  getOrganizationByGitHubInstallationId(_: {
    installationId: string;
  }): Promise<Organization | null>;
  getOrganization(_: { organization: string }): Promise<Organization | never>;
  getMyOrganization(_: { user: string }): Promise<Organization | null>;
  getOrganizations(_: { user: string }): Promise<readonly Organization[] | never>;
  createOrganization(
    _: Pick<Organization, 'cleanId'> & {
      user: string;
      adminScopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
      viewerScopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
      reservedSlugs: string[];
    },
  ): Promise<
    | {
        ok: true;
        organization: Organization;
      }
    | {
        ok: false;
        message: string;
      }
  >;

  deleteOrganization(_: OrganizationSelector): Promise<
    | (Organization & {
        tokens: string[];
      })
    | never
  >;

  updateOrganizationCleanId(
    _: OrganizationSelector &
      Pick<Organization, 'cleanId'> & { user: string; reservedSlugs: string[] },
  ): Promise<
    | {
        ok: true;
        organization: Organization;
      }
    | {
        ok: false;
        message: string;
      }
  >;

  updateOrganizationPlan(
    _: OrganizationSelector & Pick<Organization, 'billingPlan'>,
  ): Promise<Organization | never>;

  updateOrganizationRateLimits(
    _: OrganizationSelector & Pick<Organization, 'monthlyRateLimit'>,
  ): Promise<Organization | never>;

  createOrganizationInvitation(
    _: OrganizationSelector & { email: string; roleId: string },
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
    },
  ): Promise<void>;

  deleteOrganizationMember(_: OrganizationSelector & { user: string }): Promise<void>;

  updateOrganizationMemberAccess(
    _: OrganizationSelector & {
      user: string;
      scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
    },
  ): Promise<void>;

  hasOrganizationMemberRoleName(_: {
    organizationId: string;
    roleName: string;
    excludeRoleId?: string;
  }): Promise<boolean>;
  getOrganizationMemberRoles(_: {
    organizationId: string;
  }): Promise<ReadonlyArray<OrganizationMemberRole>>;
  getViewerOrganizationMemberRole(_: { organizationId: string }): Promise<OrganizationMemberRole>;
  getAdminOrganizationMemberRole(_: { organizationId: string }): Promise<OrganizationMemberRole>;
  getOrganizationMemberRole(_: { organizationId: string; roleId: string }): Promise<
    | (OrganizationMemberRole & {
        membersCount: number;
      })
    | null
  >;
  createOrganizationMemberRole(_: {
    organizationId: string;
    name: string;
    description: string;
    scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
  }): Promise<OrganizationMemberRole>;
  updateOrganizationMemberRole(_: {
    organizationId: string;
    roleId: string;
    name: string;
    description: string;
    scopes: ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
  }): Promise<OrganizationMemberRole>;
  assignOrganizationMemberRole(_: {
    organizationId: string;
    roleId: string;
    userId: string;
  }): Promise<void>;
  /**
   * Remove it after all users have been migrated to the new role system.
   */
  assignOrganizationMemberRoleToMany(_: {
    organizationId: string;
    roleId: string;
    userIds: readonly string[];
  }): Promise<void>;
  deleteOrganizationMemberRole(_: { organizationId: string; roleId: string }): Promise<void>;
  getMembersWithoutRole(_: { organizationId: string }): Promise<readonly Member[]>;

  getProject(_: ProjectSelector): Promise<Project | never>;

  getProjectId(_: ProjectSelector): Promise<string | never>;

  getProjectByCleanId(_: { cleanId: string } & OrganizationSelector): Promise<Project | null>;

  getProjects(_: OrganizationSelector): Promise<Project[] | never>;

  createProject(_: Pick<Project, 'type'> & { slug: string } & OrganizationSelector): Promise<
    | {
        ok: true;
        project: Project;
      }
    | {
        ok: false;
        message: string;
      }
  >;

  deleteProject(_: ProjectSelector): Promise<
    | (Project & {
        tokens: string[];
      })
    | never
  >;

  updateProjectSlug(_: ProjectSelector & { slug: string; user: string }): Promise<
    | {
        ok: true;
        project: Project;
      }
    | {
        ok: false;
        message: string;
      }
  >;

  updateNativeSchemaComposition(
    _: ProjectSelector & {
      enabled: boolean;
    },
  ): Promise<Project>;

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

  createTarget(_: { slug: string } & ProjectSelector): Promise<
    | {
        ok: true;
        target: Target;
      }
    | {
        ok: false;
        message: string;
      }
  >;

  updateTargetSlug(_: TargetSelector & { slug: string; user: string }): Promise<
    | {
        ok: true;
        target: Target;
      }
    | {
        ok: false;
        message: string;
      }
  >;

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

  getLatestValidVersion(_: { target: string }): Promise<SchemaVersion | never>;

  getMaybeLatestValidVersion(_: { target: string }): Promise<SchemaVersion | null | never>;

  getLatestVersion(_: TargetSelector): Promise<SchemaVersion | never>;

  getMaybeLatestVersion(_: TargetSelector): Promise<SchemaVersion | null>;

  /** Find the version before a schema version */
  getVersionBeforeVersionId(_: {
    target: string;
    beforeVersionId: string;
    beforeVersionCreatedAt: string;
    onlyComposable: boolean;
  }): Promise<SchemaVersion | null>;

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
  getSchemasOfVersion(_: { version: string; includeMetadata?: boolean }): Promise<Schema[]>;
  getSchemaByNameOfVersion(_: { versionId: string; serviceName: string }): Promise<Schema | null>;
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
  getServiceSchemaOfVersion(args: {
    schemaVersionId: string;
    serviceName: string;
  }): Promise<Schema | null>;
  getPaginatedSchemaVersionsForTargetId(args: {
    targetId: string;
    first: number | null;
    cursor: null | string;
  }): Promise<PaginatedSchemaVersionConnection>;
  getVersion(_: TargetSelector & { version: string }): Promise<SchemaVersion | never>;
  deleteSchema(
    _: {
      serviceName: string;
      composable: boolean;
      actionFn(): Promise<void>;
      changes: Array<SchemaChangeType> | null;
      diffSchemaVersionId: string | null;
      conditionalBreakingChangeMetadata: null | ConditionalBreakingChangeMetadata;
      contracts: null | Array<CreateContractVersionInput>;
      coordinatesDiff: SchemaCoordinatesDiffResult | null;
    } & TargetSelector &
      (
        | {
            compositeSchemaSDL: null;
            supergraphSDL: null;
            schemaCompositionErrors: Array<SchemaCompositionError>;
            tags: null;
          }
        | {
            compositeSchemaSDL: string;
            supergraphSDL: string | null;
            schemaCompositionErrors: null;
            tags: null | Array<string>;
          }
      ),
  ): Promise<DeletedCompositeSchema & { versionId: string }>;

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
      changes: Array<SchemaChangeType>;
      previousSchemaVersion: null | string;
      diffSchemaVersionId: null | string;
      github: null | {
        repository: string;
        sha: string;
      };
      contracts: null | Array<CreateContractVersionInput>;
      conditionalBreakingChangeMetadata: null | ConditionalBreakingChangeMetadata;
      coordinatesDiff: SchemaCoordinatesDiffResult | null;
    } & TargetSelector) &
      (
        | {
            compositeSchemaSDL: null;
            supergraphSDL: null;
            schemaCompositionErrors: Array<SchemaCompositionError>;
            tags: null;
          }
        | {
            compositeSchemaSDL: string;
            supergraphSDL: string | null;
            schemaCompositionErrors: null;
            tags: null | Array<string>;
          }
      ),
  ): Promise<SchemaVersion | never>;

  /**
   * Returns the changes between the given version and the previous version.
   * If it return `null` the schema version does not have any changes persisted.
   * This can happen if the schema version was created before we introduced persisting changes.
   */
  getSchemaChangesForVersion(_: { versionId: string }): Promise<null | Array<SchemaChangeType>>;

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

  getGetOrganizationsAndTargetsWithLimitInfo(): Promise<
    ReadonlyArray<{
      organization: string;
      org_name: string;
      org_clean_id: string;
      org_plan_name: string;
      owner_email: string;
      targets: string[];
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
  getOIDCIntegrationIdForOrganizationCleanId(_: { cleanId: string }): Promise<string | null>;

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

  updateOIDCRestrictions(_: {
    oidcIntegrationId: string;
    oidcUserAccessOnly: boolean;
  }): Promise<OIDCIntegration>;

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

  getPreflightScript(_: { targetId: string }): Promise<PreflightScript | null>;

  createPreflightScript(_: {
    targetId: string;
    sourceCode: string;
    createdByUserId: string | null;
  }): Promise<PreflightScript>;

  updatePreflightScript(_: { id: string; sourceCode: string }): Promise<PreflightScript | null>;

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
  purgeExpiredSchemaChecks(_: { expiresAt: Date }): Promise<{
    deletedSchemaCheckCount: number;
    deletedSdlStoreCount: number;
    deletedSchemaChangeApprovalCount: number;
    deletedContractSchemaChangeApprovalCount: number;
  }>;
  /**
   * Find schema check for a given ID and target.
   */
  findSchemaCheck(input: { schemaCheckId: string }): Promise<SchemaCheck | null>;
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
   * Overwrite and approve a schema check.
   */
  approveFailedSchemaCheck(input: {
    /** We inject this here as a dirty way to avoid chicken egg issues :) */
    contracts: Contracts;
    schemaCheckId: string;
    userId: string;
    comment: string | null | undefined;
  }): Promise<SchemaCheck | null>;

  /**
   * Retrieve approved schema changes for a given context.
   */
  getApprovedSchemaChangesForContextId(args: {
    targetId: string;
    contextId: string;
  }): Promise<Map<string, SchemaChangeType>>;

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

  /**
   * @deprecated It's a temporary method to force legacy composition in targets, when native composition is enabled for a project.
   */
  updateTargetSchemaComposition(_: {
    organizationId: string;
    projectId: string;
    targetId: string;
    nativeComposition: boolean;
  }): Promise<Target>;
}

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Storage implements Storage {}
export type { PaginatedSchemaVersionConnection };
