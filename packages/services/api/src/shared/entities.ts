import { DocumentNode, GraphQLError, SourceLocation } from 'graphql';
import { parse } from 'graphql';
import { z } from 'zod';
import type { AvailableRulesResponse, PolicyConfigurationObject } from '@hive/policy';
import type { CompositionFailureError } from '@hive/schema';
import { schema_policy_resource, SchemaChangeModel } from '@hive/storage';
import type {
  AlertChannelType,
  AlertType,
  AuthProvider,
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '../__generated__/types';

export const SingleSchemaModel = z
  .object({
    kind: z.literal('single'),
    id: z.string(),
    author: z.string(),
    date: z.number(),
    commit: z.string(),
    target: z.string(),
    sdl: z.string(),
    metadata: z.string().nullish(),
  })
  .required();

export const DeletedCompositeSchemaModel = z
  .object({
    kind: z.literal('composite'),
    id: z.string(),
    date: z.number(),
    target: z.string(),
    service_name: z.string(),
    action: z.literal('DELETE'),
  })
  .required();

export const PushedCompositeSchemaModel = z
  .object({
    kind: z.literal('composite'),
    id: z.string(),
    author: z.string(),
    date: z.number(),
    commit: z.string(),
    target: z.string(),
    sdl: z.string(),
    service_name: z.string(),
    service_url: z.string().nullable(),
    action: z.literal('PUSH'),
    metadata: z.string().nullish(),
  })
  .required();

export type SingleSchema = z.infer<typeof SingleSchemaModel>;
export type DeletedCompositeSchema = z.infer<typeof DeletedCompositeSchemaModel>;
export type PushedCompositeSchema = z.infer<typeof PushedCompositeSchemaModel>;
export type CompositeSchema = PushedCompositeSchema;

export type Schema = SingleSchema | CompositeSchema;
export type SchemaLog = SingleSchema | PushedCompositeSchema | DeletedCompositeSchema;

export interface DateRange {
  from: Date;
  to: Date;
}

export interface SchemaVersion {
  id: string;
  valid: boolean;
  createdAt: string;
  commit: string;
  baseSchema: string | null;
  hasPersistedSchemaChanges: boolean;
  previousSchemaVersionId: null | string;
  compositeSchemaSDL: null | string;
  supergraphSDL: null | string;
  schemaCompositionErrors: Array<SchemaCompositionError> | null;
}

export interface SchemaObject {
  document: DocumentNode;
  source: string;
  url?: string | null;
  raw: string;
}

export interface PersistedOperation {
  id: string;
  operationHash: string;
  name: string;
  kind: string;
  project: string;
  content: string;
  date: string;
}

export const emptySource = '*';

export class GraphQLDocumentStringInvalidError extends Error {
  constructor(message: string, location?: SourceLocation) {
    const locationString = location ? ` at line ${location.line}, column ${location.column}` : '';
    super(`The provided SDL is not valid${locationString}\n: ${message}`);
  }
}

export function createSchemaObject(
  schema:
    | Pick<SingleSchema, 'sdl'>
    | Pick<PushedCompositeSchema, 'sdl' | 'service_name' | 'service_url'>,
): SchemaObject {
  let document: DocumentNode;

  try {
    document = parse(schema.sdl);
  } catch (err) {
    if (err instanceof GraphQLError) {
      throw new GraphQLDocumentStringInvalidError(err.message, err.locations?.[0]);
    }
    throw err;
  }

  return {
    document,
    raw: schema.sdl,
    source: 'service_name' in schema ? schema.service_name : emptySource,
    url: 'service_url' in schema ? schema.service_url : null,
  };
}

export enum ProjectType {
  FEDERATION = 'FEDERATION',
  STITCHING = 'STITCHING',
  SINGLE = 'SINGLE',
}

export interface OrganizationGetStarted {
  id: string;
  creatingProject: boolean;
  publishingSchema: boolean;
  checkingSchema: boolean;
  invitingMembers: boolean;
  reportingOperations: boolean;
  enablingUsageBasedBreakingChanges: boolean;
}

export interface Organization {
  id: string;
  cleanId: string;
  name: string;
  billingPlan: string;
  monthlyRateLimit: {
    retentionInDays: number;
    operations: number;
  };
  getStarted: OrganizationGetStarted;
  featureFlags: {
    compareToPreviousComposableVersion: boolean;
  };
}

export interface OrganizationInvitation {
  organization_id: string;
  code: string;
  email: string;
  created_at: string;
  expires_at: string;
}

export interface OrganizationBilling {
  organizationId: string;
  externalBillingReference: string;
  billingEmailAddress?: string | null;
}

export interface OIDCIntegration {
  id: string;
  linkedOrganizationId: string;
  clientId: string;
  encryptedClientSecret: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  authorizationEndpoint: string;
}

export interface CDNAccessToken {
  readonly id: string;
  readonly targetId: string;
  readonly s3Key: string;
  readonly firstCharacters: string;
  readonly lastCharacters: string;
  readonly alias: string;
  readonly createdAt: string;
}

export interface DocumentCollection {
  id: string;
  title: string;
  description: string | null;
  targetId: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PaginatedDocumentCollections = Readonly<{
  edges: ReadonlyArray<{
    node: DocumentCollection;
    cursor: string;
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;

export interface DocumentCollectionOperation {
  id: string;
  title: string;
  contents: string;
  variables: string | null;
  headers: string | null;
  createdByUserId: string | null;
  documentCollectionId: string;
  createdAt: string;
  updatedAt: string;
}

export type PaginatedDocumentCollectionOperations = Readonly<{
  edges: ReadonlyArray<{
    node: DocumentCollectionOperation;
    cursor: string;
  }>;
  pageInfo: Readonly<{
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;

export interface Project {
  id: string;
  cleanId: string;
  orgId: string;
  name: string;
  type: ProjectType;
  buildUrl?: string | null;
  validationUrl?: string | null;
  gitRepository?: string | null;
  legacyRegistryModel: boolean;
  externalComposition: {
    enabled: boolean;
    endpoint?: string | null;
    encryptedSecret?: string | null;
  };
}

export interface Target {
  id: string;
  cleanId: string;
  projectId: string;
  orgId: string;
  name: string;
}

export interface Token {
  token: string;
  tokenAlias: string;
  name: string;
  target: string;
  project: string;
  organization: string;
  date: string;
  lastUsedAt: string;
  scopes: readonly string[];
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  provider: AuthProvider;
  superTokensUserId: string | null;
  isAdmin: boolean;
  externalAuthUserId: string | null;
  oidcIntegrationId: string | null;
}

export interface Member {
  id: string;
  isOwner: boolean;
  user: User;
  organization: string;
  scopes: Array<OrganizationAccessScope | ProjectAccessScope | TargetAccessScope>;
}

export interface TargetSettings {
  validation: {
    enabled: boolean;
    period: number;
    percentage: number;
    targets: readonly string[];
    excludedClients: readonly string[];
  };
}

export interface ComposeAndValidateResult {
  supergraph: string | null;
  errors: CompositionFailureError[];
  sdl: string | null;
}

export interface Orchestrator {
  composeAndValidate(
    schemas: SchemaObject[],
    config: Project['externalComposition'],
  ): Promise<ComposeAndValidateResult>;
}

export interface ActivityObject {
  id: string;
  type: string;
  meta: any;
  createdAt: Date;
  target?: Target;
  project?: Project;
  organization: Organization;
  user?: User;
}

export interface AlertChannel {
  id: string;
  projectId: string;
  type: AlertChannelType;
  name: string;
  createdAt: string;
  slackChannel: string | null;
  webhookEndpoint: string | null;
}

export interface Alert {
  id: string;
  type: AlertType;
  channelId: string;
  organizationId: string;
  projectId: string;
  targetId: string;
  createdAt: string;
}

export interface AdminOrganizationStats {
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
}

export const SchemaCompositionErrorModel = z.object({
  message: z.string(),
  source: z.union([z.literal('graphql'), z.literal('composition')]),
});

export type SchemaCompositionError = z.TypeOf<typeof SchemaCompositionErrorModel>;

export const SchemaPolicyWarningModel = z.object({
  message: z.string(),
  line: z.number(),
  column: z.number(),
  ruleId: z.string(),
  endLine: z.number().nullable(),
  endColumn: z.number().nullable(),
});

const FailedSchemaCheckPartialModel = z.intersection(
  z.object({
    isSuccess: z.literal(false),

    breakingSchemaChanges: z.array(SchemaChangeModel).nullable(),
    safeSchemaChanges: z.array(SchemaChangeModel).nullable(),

    schemaPolicyWarnings: z.array(SchemaPolicyWarningModel).nullable(),
    schemaPolicyErrors: z.array(SchemaPolicyWarningModel).nullable(),
  }),
  z.union([
    z.object({
      schemaCompositionErrors: z.array(SchemaCompositionErrorModel),

      compositeSchemaSDL: z.null(),
      supergraphSDL: z.null(),
    }),
    z.object({
      schemaCompositionErrors: z.null(),

      compositeSchemaSDL: z.string(),
      supergraphSDL: z.string().nullable(),
    }),
  ]),
);

const SuccessfulSchemaCheckPartialModel = z.object({
  isSuccess: z.literal(true),
  schemaCompositionErrors: z.null(),

  breakingSchemaChanges: z.null(),
  safeSchemaChanges: z.array(SchemaChangeModel).nullable(),
  schemaPolicyWarnings: z.array(SchemaPolicyWarningModel).nullable(),
  schemaPolicyErrors: z.null(),

  compositeSchemaSDL: z.string(),
  supergraphSDL: z.string().nullable(),
});

const SchemaCheckSharedFieldsModel = z.object({
  schemaSDL: z.string(),
  serviceName: z.string().nullable(),
  targetId: z.string(),
  schemaVersionId: z.string().nullable(),
});

const SchemaCheckInputModel = z.intersection(
  SchemaCheckSharedFieldsModel,
  z.union([FailedSchemaCheckPartialModel, SuccessfulSchemaCheckPartialModel]),
);

const PersistedSchemaCheckPartialModel = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const FailedSchemaCheckModel = z.intersection(
  SchemaCheckSharedFieldsModel,
  z.intersection(PersistedSchemaCheckPartialModel, FailedSchemaCheckPartialModel),
);

export const SuccessfulSchemaCheckModel = z.intersection(
  SchemaCheckSharedFieldsModel,
  z.intersection(PersistedSchemaCheckPartialModel, SuccessfulSchemaCheckPartialModel),
);

export const SchemaCheckModel = z.union([FailedSchemaCheckModel, SuccessfulSchemaCheckModel]);

export type SchemaCheckInput = z.TypeOf<typeof SchemaCheckInputModel>;
export type SchemaCheck = z.TypeOf<typeof SchemaCheckModel>;
export type FailedSchemaCheck = z.TypeOf<typeof FailedSchemaCheckModel>;
export type SuccessfulSchemaCheck = z.TypeOf<typeof SuccessfulSchemaCheckModel>;

export type SchemaPolicy = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  config: PolicyConfigurationObject;
  resource: schema_policy_resource;
  resourceId: string;
  allowOverrides: boolean;
};

export type SchemaPolicyAvailableRuleObject = AvailableRulesResponse[0];
