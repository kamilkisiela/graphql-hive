import { DocumentNode, GraphQLError, SourceLocation } from 'graphql';
import { parse } from 'graphql';
import type {
  AlertChannelType,
  AlertType,
  AuthProvider,
  OrganizationAccessScope,
  ProjectAccessScope,
  SchemaError,
  TargetAccessScope,
} from '../__generated__/types';

export interface Schema {
  id: string;
  author: string;
  source: string;
  date: string;
  commit: string;
  target: string;
  url?: string | null;
  service?: string | null;
  metadata?: Record<string, any> | null;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface SchemaVersion {
  id: string;
  valid: boolean;
  date: number;
  commit: string;
  base_schema: string | null;
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

export function createSchemaObject(schema: Schema): SchemaObject {
  let document: DocumentNode;

  try {
    document = parse(schema.source);
  } catch (err) {
    if (err instanceof GraphQLError) {
      throw new GraphQLDocumentStringInvalidError(err.message, err.locations?.[0]);
    }
    throw err;
  }

  return {
    document,
    raw: schema.source,
    source: schema.service ?? emptySource,
    url: schema.url ?? null,
  };
}

export enum ProjectType {
  FEDERATION = 'FEDERATION',
  STITCHING = 'STITCHING',
  SINGLE = 'SINGLE',
  CUSTOM = 'CUSTOM',
}

export enum OrganizationType {
  PERSONAL = 'PERSONAL',
  REGULAR = 'REGULAR',
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
  type: OrganizationType;
  billingPlan: string;
  monthlyRateLimit: {
    retentionInDays: number;
    operations: number;
  };
  getStarted: OrganizationGetStarted;
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
  readonly createdAt: string;
}

export interface Project {
  id: string;
  cleanId: string;
  orgId: string;
  name: string;
  type: ProjectType;
  buildUrl?: string | null;
  validationUrl?: string | null;
  gitRepository?: string | null;
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

export interface Orchestrator {
  ensureConfig(config: any): void | never;
  validate(schemas: SchemaObject[], config: any): Promise<SchemaError[]>;
  build(schemas: SchemaObject[], config: any): Promise<SchemaObject>;
  supergraph(schemas: SchemaObject[], config: any): Promise<string | null>;
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
