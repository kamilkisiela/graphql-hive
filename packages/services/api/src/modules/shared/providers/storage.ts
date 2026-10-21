import { Injectable } from 'graphql-modules';
import type { PolicyConfigurationObject } from '@hive/policy';
import { PostgresDatabasePool } from '@hive/postgres';
import type {
  PaginatedOrganizationInvitationConnection,
  SchemaChangeType,
  SchemaCheck,
  SchemaCheckInput,
} from '@hive/storage';
import type { SchemaChecksFilter } from '../../../__generated__/types';
import type {
  Alert,
  AlertChannel,
  CDNAccessToken,
  DocumentCollection,
  DocumentCollectionOperation,
  Member,
  OIDCIntegration,
  Organization,
  OrganizationBilling,
  OrganizationInvitation,
  PaginatedDocumentCollectionOperations,
  PaginatedDocumentCollections,
  SchemaPolicy,
  User,
} from '../../../shared/entities';
import type {
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '../../auth/providers/scopes';
import type { ResourceAssignmentGroup } from '../../organization/lib/resource-assignment-model';
import type { Contracts } from '../../schema/providers/contracts';

export interface OrganizationSelector {
  organizationId: string;
}

export interface ProjectSelector extends OrganizationSelector {
  projectId: string;
}

export interface TargetSelector extends ProjectSelector {
  targetId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Storage {
  pool: PostgresDatabasePool;
  destroy(): Promise<void>;
  isReady(): Promise<boolean>;
  ensureUserExists(_: {
    superTokensUserId: string;
    email: string;
    oidcIntegration: null | {
      id: string;
    };
    firstName: string | null;
    lastName: string | null;
  }): Promise<
    | {
        ok: true;
        user: User;
        action: 'created' | 'no_action';
      }
    | {
        ok: false;
        reason: string;
      }
  >;

  getUserBySuperTokenId(_: { superTokensUserId: string }): Promise<User | null>;
  getUserById(_: { id: string }): Promise<User | null>;

  updateUser(_: { id: string; fullName: string; displayName: string }): Promise<User | never>;

  getOrganizationId(_: { organizationSlug: string }): Promise<string | null>;
  getOrganizationByInviteCode(_: {
    inviteCode: string;
    email: string;
  }): Promise<Organization | null>;
  getOrganizationBySlug(_: { slug: string }): Promise<Organization | null>;
  getOrganizationByGitHubInstallationId(_: {
    installationId: string;
  }): Promise<Organization | null>;
  getOrganization(_: { organizationId: string }): Promise<Organization | never>;
  getOrganizations(_: { userId: string }): Promise<readonly Organization[] | never>;
  createOrganization(
    _: Pick<Organization, 'slug'> & {
      userId: string;
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

  updateOrganizationSlug(
    _: OrganizationSelector &
      Pick<Organization, 'slug'> & { userId: string; reservedSlugs: string[] },
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
    action?: () => Promise<void>,
  ): Promise<Organization | never>;

  createOrganizationInvitation(
    _: OrganizationSelector & {
      email: string;
      roleId: string;
      resourceAssignments: ResourceAssignmentGroup | null;
    },
  ): Promise<OrganizationInvitation | never>;

  deleteOrganizationInvitationByEmail(
    _: OrganizationSelector & { email: string },
  ): Promise<OrganizationInvitation | null>;

  createOrganizationTransferRequest(
    _: OrganizationSelector & {
      userId: string;
    },
  ): Promise<{
    code: string;
  }>;

  getOrganizationTransferRequest(
    _: OrganizationSelector & {
      code: string;
      userId: string;
    },
  ): Promise<{
    code: string;
  } | null>;

  answerOrganizationTransferRequest(
    _: OrganizationSelector & {
      code: string;
      userId: string;
      accept: boolean;
    },
  ): Promise<void>;

  countOrganizationMembers(_: OrganizationSelector): Promise<number>;

  getOrganizationInvitations(
    organizationId: string,
    args: {
      first: number | null;
      after: string | null;
    },
  ): Promise<PaginatedOrganizationInvitationConnection>;

  getOrganizationOwnerId(_: OrganizationSelector): Promise<string | null>;

  getOrganizationOwner(_: OrganizationSelector): Promise<Member | never>;

  getOrganizationMember(_: OrganizationSelector & { userId: string }): Promise<Member | null>;

  getOrganizationMemberAccessPairs(
    _: readonly (OrganizationSelector & { userId: string })[],
  ): Promise<
    ReadonlyArray<ReadonlyArray<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>>
  >;

  addOrganizationMemberViaInvitationCode(
    _: OrganizationSelector & {
      code: string;
      userId: string;
    },
  ): Promise<void>;

  deleteOrganizationMember(_: OrganizationSelector & { userId: string }): Promise<void>;

  deleteOrganizationMemberRole(_: { organizationId: string; roleId: string }): Promise<void>;

  getPaginatedSchemaChecksForSchemaProposal<
    TransformedSchemaCheck extends SchemaCheck = SchemaCheck,
  >(_: {
    proposalId: string;
    first: number | null;
    cursor: null | string;
    transformNode?: (check: SchemaCheck) => TransformedSchemaCheck;
    latest?: boolean;
  }): Promise<
    Readonly<{
      edges: ReadonlyArray<{
        // @todo consider conditionally excluding this from the query for performance
        // Omit<TransformedSchemaCheck, 'supergraphSDL' | 'compositeSchemaSDL' | 'schemaSDL'>;
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
  addSlackIntegration(_: OrganizationSelector & { token: string }): Promise<void>;

  deleteSlackIntegration(_: OrganizationSelector): Promise<void>;

  getSlackIntegrationToken(_: OrganizationSelector): Promise<string | null | undefined>;

  addGitHubIntegration(_: OrganizationSelector & { installationId: string }): Promise<void>;

  deleteGitHubIntegration(_: OrganizationSelector): Promise<void>;

  getGitHubIntegrationInstallationId(_: OrganizationSelector): Promise<string | null | undefined>;

  addAlertChannel(_: {
    name: string;
    organizationId: string;
    projectId: string;
    type: AlertChannel['type'];
    slackChannel?: string | null;
    webhookEndpoint?: string | null;
  }): Promise<AlertChannel>;

  deleteAlertChannels(_: {
    channelIds: readonly string[];
    projectId: string;
    organizationId: string;
  }): Promise<readonly AlertChannel[]>;

  getAlertChannels(_: ProjectSelector): Promise<readonly AlertChannel[]>;

  addAlert(_: {
    channelId: string;
    organizationId: string;
    projectId: string;
    targetId: string;
    type: Alert['type'];
  }): Promise<Alert>;

  deleteAlerts(
    _: ProjectSelector & {
      alertIds: readonly string[];
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
  getOIDCIntegrationIdForOrganizationSlug(_: { slug: string }): Promise<string | null>;

  getOIDCIntegrationById(_: { oidcIntegrationId: string }): Promise<OIDCIntegration | null>;

  createOIDCIntegrationForOrganization(_: {
    organizationId: string;
    clientId: string;
    encryptedClientSecret: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    authorizationEndpoint: string;
    additionalScopes: readonly string[];
    userIdClaim: string | null;
  }): Promise<{ type: 'ok'; oidcIntegration: OIDCIntegration } | { type: 'error'; reason: string }>;

  updateOIDCIntegration(_: {
    oidcIntegrationId: string;
    clientId: string | null;
    encryptedClientSecret: string | null;
    tokenEndpoint: string | null;
    userinfoEndpoint: string | null;
    authorizationEndpoint: string | null;
    additionalScopes: readonly string[] | null;
    userIdClaim: string | null;
  }): Promise<OIDCIntegration>;

  deleteOIDCIntegration(_: { oidcIntegrationId: string }): Promise<void>;

  updateOIDCRestrictions(_: {
    oidcIntegrationId: string;
    oidcUserJoinOnly: boolean | null;
    oidcUserAccessOnly: boolean | null;
    requireInvitation: boolean | null;
    userProvisioningRequired: boolean | null;
    oidcForVerifiedDomainsRequired: boolean | null;
  }): Promise<OIDCIntegration>;

  updateOIDCDefaultMemberRole(_: {
    oidcIntegrationId: string;
    roleId: string;
  }): Promise<OIDCIntegration>;

  updateOIDCDefaultAssignedResources(_: {
    oidcIntegrationId: string;
    assignedResources: ResourceAssignmentGroup;
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
  createSchemaCheck(
    _: SchemaCheckInput & {
      expiresAt: Date | null;
      schemaProposalId?: string | null;
      schemaProposalChanges: null | Array<SchemaChangeType>;
    },
  ): Promise<SchemaCheck>;
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
  findSchemaCheck(input: {
    targetId: string;
    schemaCheckId: string;
    /** Skips reading the check's six SDLs; their fields come back empty. Defaults to true. */
    withSDL?: boolean;
    /** Skips reading safe and breaking changes. Defaults to true. */
    withChanges?: boolean;
  }): Promise<SchemaCheck | null>;
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
    /**
     * Optionally include the SDLs (composite, service, and supergraph) in the result.
     * This is separated for performance reasons.
     */
    withSDL?: boolean | null;
    /**
     * Optionally include changes (safe; breaking) in the result.
     * This is separated for performance reasons.
     */
    withChanges?: boolean;
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
   * Distinct, sorted service names of the schema checks of a target.
   */
  getSchemaCheckServiceNamesForTarget(_: { targetId: string }): Promise<ReadonlyArray<string>>;
  /**
   * Overwrite and approve a schema check.
   */
  approveFailedSchemaCheck(input: {
    targetId: string;
    /** We inject this here as a dirty way to avoid chicken egg issues :) */
    contracts: Contracts;
    schemaCheckId: string;
    userId: string | null;
    comment: string | null | undefined;
    author: string | null | undefined;
  }): Promise<SchemaCheck | null>;

  /**
   * Retrieve approved schema changes for a given context.
   */
  getApprovedSchemaChangesForContextId(args: {
    targetId: string;
    contextId: string;
  }): Promise<Map<string, SchemaChangeType>>;

  // Zendesk
  setZendeskUserId(_: { userId: string; zendeskId: string }): Promise<void>;
  setZendeskOrganizationId(_: { organizationId: string; zendeskId: string }): Promise<void>;
  setZendeskOrganizationUserConnection(_: {
    userId: string;
    organizationId: string;
  }): Promise<void>;
}

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Storage implements Storage {}
