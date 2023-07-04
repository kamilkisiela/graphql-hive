/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
  JSON: { input: any; output: any; }
  JSONSchemaObject: { input: any; output: any; }
  SafeInt: { input: any; output: any; }
};

export type Activity = {
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  type: Scalars['String']['output'];
};

export type ActivityConnection = {
  __typename?: 'ActivityConnection';
  nodes: Array<Activity>;
  total: Scalars['Int']['output'];
};

export type AddAlertChannelError = Error & {
  __typename?: 'AddAlertChannelError';
  inputErrors: AddAlertChannelInputErrors;
  message: Scalars['String']['output'];
};

export type AddAlertChannelInput = {
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  slack?: InputMaybe<SlackChannelInput>;
  type: AlertChannelType;
  webhook?: InputMaybe<WebhookChannelInput>;
};

export type AddAlertChannelInputErrors = {
  __typename?: 'AddAlertChannelInputErrors';
  name?: Maybe<Scalars['String']['output']>;
  slackChannel?: Maybe<Scalars['String']['output']>;
  webhookEndpoint?: Maybe<Scalars['String']['output']>;
};

export type AddAlertChannelOk = {
  __typename?: 'AddAlertChannelOk';
  addedAlertChannel: AlertChannel;
  updatedProject: Project;
};

export type AddAlertChannelResult = {
  __typename?: 'AddAlertChannelResult';
  error?: Maybe<AddAlertChannelError>;
  ok?: Maybe<AddAlertChannelOk>;
};

export type AddAlertError = Error & {
  __typename?: 'AddAlertError';
  message: Scalars['String']['output'];
};

export type AddAlertInput = {
  channel: Scalars['ID']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
  type: AlertType;
};

export type AddAlertOk = {
  __typename?: 'AddAlertOk';
  addedAlert: Alert;
  updatedProject: Project;
};

export type AddAlertResult = {
  __typename?: 'AddAlertResult';
  error?: Maybe<AddAlertError>;
  ok?: Maybe<AddAlertOk>;
};

export type AddGitHubIntegrationInput = {
  installationId: Scalars['ID']['input'];
  organization: Scalars['ID']['input'];
};

export type AddSlackIntegrationInput = {
  organization: Scalars['ID']['input'];
  token: Scalars['String']['input'];
};

export type AdminGeneralStats = {
  __typename?: 'AdminGeneralStats';
  operationsOverTime: Array<AdminOperationPoint>;
};

export type AdminOperationPoint = {
  __typename?: 'AdminOperationPoint';
  count: Scalars['SafeInt']['output'];
  date: Scalars['DateTime']['output'];
};

export type AdminOrganizationStats = {
  __typename?: 'AdminOrganizationStats';
  operations: Scalars['SafeInt']['output'];
  organization: Organization;
  persistedOperations: Scalars['Int']['output'];
  projects: Scalars['Int']['output'];
  targets: Scalars['Int']['output'];
  users: Scalars['Int']['output'];
  versions: Scalars['Int']['output'];
};

export type AdminQuery = {
  __typename?: 'AdminQuery';
  stats: AdminStats;
};


export type AdminQueryStatsArgs = {
  period: DateRangeInput;
};

export type AdminStats = {
  __typename?: 'AdminStats';
  general: AdminGeneralStats;
  organizations: Array<AdminOrganizationStats>;
};

export type Alert = {
  __typename?: 'Alert';
  channel: AlertChannel;
  id: Scalars['ID']['output'];
  target: Target;
  type: AlertType;
};

export type AlertChannel = {
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  type: AlertChannelType;
};

export enum AlertChannelType {
  Slack = 'SLACK',
  Webhook = 'WEBHOOK'
}

export type AlertSlackChannel = AlertChannel & {
  __typename?: 'AlertSlackChannel';
  channel: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  type: AlertChannelType;
};

export enum AlertType {
  SchemaChangeNotifications = 'SCHEMA_CHANGE_NOTIFICATIONS'
}

export type AlertWebhookChannel = AlertChannel & {
  __typename?: 'AlertWebhookChannel';
  endpoint: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  type: AlertChannelType;
};

export type AnswerOrganizationTransferRequestError = Error & {
  __typename?: 'AnswerOrganizationTransferRequestError';
  message: Scalars['String']['output'];
};

export type AnswerOrganizationTransferRequestInput = {
  accept: Scalars['Boolean']['input'];
  code: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
};

export type AnswerOrganizationTransferRequestOk = {
  __typename?: 'AnswerOrganizationTransferRequestOk';
  accepted: Scalars['Boolean']['output'];
};

/** @oneOf */
export type AnswerOrganizationTransferRequestResult = {
  __typename?: 'AnswerOrganizationTransferRequestResult';
  error?: Maybe<AnswerOrganizationTransferRequestError>;
  ok?: Maybe<AnswerOrganizationTransferRequestOk>;
};

export enum AuthProvider {
  /** Username-Password-Authentication */
  Auth0 = 'AUTH0',
  Github = 'GITHUB',
  Google = 'GOOGLE'
}

export type BillingConfiguration = {
  __typename?: 'BillingConfiguration';
  billingAddress?: Maybe<BillingDetails>;
  hasActiveSubscription: Scalars['Boolean']['output'];
  hasPaymentIssues: Scalars['Boolean']['output'];
  invoices?: Maybe<Array<BillingInvoice>>;
  paymentMethod?: Maybe<BillingPaymentMethod>;
  upcomingInvoice?: Maybe<BillingInvoice>;
};

export type BillingDetails = {
  __typename?: 'BillingDetails';
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  line1?: Maybe<Scalars['String']['output']>;
  line2?: Maybe<Scalars['String']['output']>;
  postalCode?: Maybe<Scalars['String']['output']>;
  state?: Maybe<Scalars['String']['output']>;
};

export type BillingInvoice = {
  __typename?: 'BillingInvoice';
  amount: Scalars['Float']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  pdfLink?: Maybe<Scalars['String']['output']>;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  status: BillingInvoiceStatus;
};

export enum BillingInvoiceStatus {
  Draft = 'DRAFT',
  Open = 'OPEN',
  Paid = 'PAID',
  Uncollectible = 'UNCOLLECTIBLE',
  Void = 'VOID'
}

export type BillingPaymentMethod = {
  __typename?: 'BillingPaymentMethod';
  brand: Scalars['String']['output'];
  expMonth: Scalars['Int']['output'];
  expYear: Scalars['Int']['output'];
  last4: Scalars['String']['output'];
};

export type BillingPlan = {
  __typename?: 'BillingPlan';
  basePrice?: Maybe<Scalars['Float']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  includedOperationsLimit?: Maybe<Scalars['SafeInt']['output']>;
  name: Scalars['String']['output'];
  planType: BillingPlanType;
  pricePerOperationsUnit?: Maybe<Scalars['Float']['output']>;
  rateLimit: UsageRateLimitType;
  retentionInDays: Scalars['Int']['output'];
};

export enum BillingPlanType {
  Enterprise = 'ENTERPRISE',
  Hobby = 'HOBBY',
  Pro = 'PRO'
}

export type CdnAccessToken = {
  __typename?: 'CdnAccessToken';
  alias: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  firstCharacters: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastCharacters: Scalars['String']['output'];
};

export type CdnAccessTokenCreateError = Error & {
  __typename?: 'CdnAccessTokenCreateError';
  message: Scalars['String']['output'];
};

export type CdnAccessTokenCreateOk = {
  __typename?: 'CdnAccessTokenCreateOk';
  cdnUrl: Scalars['String']['output'];
  createdCdnAccessToken: CdnAccessToken;
  secretAccessToken: Scalars['String']['output'];
};

/** @oneOf */
export type CdnAccessTokenCreateResult = {
  __typename?: 'CdnAccessTokenCreateResult';
  error?: Maybe<CdnAccessTokenCreateError>;
  ok?: Maybe<CdnAccessTokenCreateOk>;
};

export type CdnTokenResult = {
  __typename?: 'CdnTokenResult';
  token: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type ChangePlanResult = {
  __typename?: 'ChangePlanResult';
  newPlan: BillingPlanType;
  organization: Organization;
  previousPlan: BillingPlanType;
};

export type ClientNameStats = {
  __typename?: 'ClientNameStats';
  count: Scalars['Float']['output'];
  name: Scalars['String']['output'];
};

export type ClientStats = {
  __typename?: 'ClientStats';
  count: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
  versions: Array<ClientVersionStats>;
};

export type ClientStatsByTargetsInput = {
  organization: Scalars['ID']['input'];
  period: DateRangeInput;
  project: Scalars['ID']['input'];
  targetIds: Array<Scalars['ID']['input']>;
};

export type ClientStatsConnection = {
  __typename?: 'ClientStatsConnection';
  nodes: Array<ClientStats>;
  total: Scalars['Int']['output'];
};

export type ClientVersionStats = {
  __typename?: 'ClientVersionStats';
  count: Scalars['Float']['output'];
  percentage: Scalars['Float']['output'];
  version: Scalars['String']['output'];
};

export type CodePosition = {
  __typename?: 'CodePosition';
  column: Scalars['Int']['output'];
  line: Scalars['Int']['output'];
};

export type CompositeSchema = {
  __typename?: 'CompositeSchema';
  author: Scalars['String']['output'];
  commit: Scalars['ID']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  metadata?: Maybe<Scalars['String']['output']>;
  service?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  url?: Maybe<Scalars['String']['output']>;
};

export type CreateCdnAccessTokenInput = {
  alias: Scalars['String']['input'];
  selector: TargetSelectorInput;
};

export type CreateDocumentCollectionInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type CreateDocumentCollectionOperationInput = {
  collectionId: Scalars['ID']['input'];
  headers?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  query: Scalars['String']['input'];
  variables?: InputMaybe<Scalars['String']['input']>;
};

export type CreateOidcIntegrationError = Error & {
  __typename?: 'CreateOIDCIntegrationError';
  details: CreateOidcIntegrationErrorDetails;
  message: Scalars['String']['output'];
};

export type CreateOidcIntegrationErrorDetails = {
  __typename?: 'CreateOIDCIntegrationErrorDetails';
  authorizationEndpoint?: Maybe<Scalars['String']['output']>;
  clientId?: Maybe<Scalars['String']['output']>;
  clientSecret?: Maybe<Scalars['String']['output']>;
  tokenEndpoint?: Maybe<Scalars['String']['output']>;
  userinfoEndpoint?: Maybe<Scalars['String']['output']>;
};

export type CreateOidcIntegrationInput = {
  authorizationEndpoint: Scalars['String']['input'];
  clientId: Scalars['ID']['input'];
  clientSecret: Scalars['String']['input'];
  organizationId: Scalars['ID']['input'];
  tokenEndpoint: Scalars['String']['input'];
  userinfoEndpoint: Scalars['String']['input'];
};

export type CreateOidcIntegrationOk = {
  __typename?: 'CreateOIDCIntegrationOk';
  createdOIDCIntegration: OidcIntegration;
  organization: Organization;
};

export type CreateOidcIntegrationResult = {
  __typename?: 'CreateOIDCIntegrationResult';
  error?: Maybe<CreateOidcIntegrationError>;
  ok?: Maybe<CreateOidcIntegrationOk>;
};

export type CreateOrganizationError = Error & {
  __typename?: 'CreateOrganizationError';
  inputErrors: CreateOrganizationInputErrors;
  message: Scalars['String']['output'];
};

export type CreateOrganizationInput = {
  name: Scalars['String']['input'];
};

export type CreateOrganizationInputErrors = {
  __typename?: 'CreateOrganizationInputErrors';
  name?: Maybe<Scalars['String']['output']>;
};

export type CreateOrganizationOk = {
  __typename?: 'CreateOrganizationOk';
  createdOrganizationPayload: OrganizationPayload;
};

export type CreateOrganizationResult = {
  __typename?: 'CreateOrganizationResult';
  error?: Maybe<CreateOrganizationError>;
  ok?: Maybe<CreateOrganizationOk>;
};

export type CreateProjectError = Error & {
  __typename?: 'CreateProjectError';
  inputErrors: CreateProjectInputErrors;
  message: Scalars['String']['output'];
};

export type CreateProjectInput = {
  buildUrl?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  type: ProjectType;
  validationUrl?: InputMaybe<Scalars['String']['input']>;
};

export type CreateProjectInputErrors = {
  __typename?: 'CreateProjectInputErrors';
  buildUrl?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  validationUrl?: Maybe<Scalars['String']['output']>;
};

export type CreateProjectOk = {
  __typename?: 'CreateProjectOk';
  createdProject: Project;
  createdTargets: Array<Target>;
  updatedOrganization: Organization;
};

export type CreateProjectResult = {
  __typename?: 'CreateProjectResult';
  error?: Maybe<CreateProjectError>;
  ok?: Maybe<CreateProjectOk>;
};

export type CreateTargetError = Error & {
  __typename?: 'CreateTargetError';
  inputErrors: CreateTargetInputErrors;
  message: Scalars['String']['output'];
};

export type CreateTargetInput = {
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type CreateTargetInputErrors = {
  __typename?: 'CreateTargetInputErrors';
  name?: Maybe<Scalars['String']['output']>;
};

export type CreateTargetOk = {
  __typename?: 'CreateTargetOk';
  createdTarget: Target;
  selector: TargetSelector;
};

export type CreateTargetResult = {
  __typename?: 'CreateTargetResult';
  error?: Maybe<CreateTargetError>;
  ok?: Maybe<CreateTargetOk>;
};

export type CreateTokenError = Error & {
  __typename?: 'CreateTokenError';
  message: Scalars['String']['output'];
};

export type CreateTokenInput = {
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  organizationScopes: Array<OrganizationAccessScope>;
  project: Scalars['ID']['input'];
  projectScopes: Array<ProjectAccessScope>;
  target: Scalars['ID']['input'];
  targetScopes: Array<TargetAccessScope>;
};

export type CreateTokenOk = {
  __typename?: 'CreateTokenOk';
  createdToken: Token;
  secret: Scalars['String']['output'];
  selector: TargetSelector;
};

export type CreateTokenPayload = {
  __typename?: 'CreateTokenPayload';
  createdToken: Token;
  secret: Scalars['String']['output'];
  selector: TargetSelector;
};

export type CreateTokenResult = {
  __typename?: 'CreateTokenResult';
  error?: Maybe<CreateTokenError>;
  ok?: Maybe<CreateTokenOk>;
};

export enum CriticalityLevel {
  Breaking = 'Breaking',
  Dangerous = 'Dangerous',
  Safe = 'Safe'
}

export type DateRange = {
  __typename?: 'DateRange';
  from: Scalars['DateTime']['output'];
  to: Scalars['DateTime']['output'];
};

export type DateRangeInput = {
  from: Scalars['DateTime']['input'];
  to: Scalars['DateTime']['input'];
};

export type DeleteAlertChannelsError = Error & {
  __typename?: 'DeleteAlertChannelsError';
  message: Scalars['String']['output'];
};

export type DeleteAlertChannelsInput = {
  channels: Array<Scalars['ID']['input']>;
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type DeleteAlertChannelsOk = {
  __typename?: 'DeleteAlertChannelsOk';
  updatedProject: Project;
};

export type DeleteAlertChannelsResult = {
  __typename?: 'DeleteAlertChannelsResult';
  error?: Maybe<DeleteAlertChannelsError>;
  ok?: Maybe<DeleteAlertChannelsOk>;
};

export type DeleteAlertsError = Error & {
  __typename?: 'DeleteAlertsError';
  message: Scalars['String']['output'];
};

export type DeleteAlertsInput = {
  alerts: Array<Scalars['ID']['input']>;
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type DeleteAlertsOk = {
  __typename?: 'DeleteAlertsOk';
  updatedProject: Project;
};

export type DeleteAlertsResult = {
  __typename?: 'DeleteAlertsResult';
  error?: Maybe<DeleteAlertsError>;
  ok?: Maybe<DeleteAlertsOk>;
};

export type DeleteCdnAccessTokenError = Error & {
  __typename?: 'DeleteCdnAccessTokenError';
  message: Scalars['String']['output'];
};

export type DeleteCdnAccessTokenInput = {
  cdnAccessTokenId: Scalars['ID']['input'];
  selector: TargetSelectorInput;
};

export type DeleteCdnAccessTokenOk = {
  __typename?: 'DeleteCdnAccessTokenOk';
  deletedCdnAccessTokenId: Scalars['ID']['output'];
};

/** @oneOf */
export type DeleteCdnAccessTokenResult = {
  __typename?: 'DeleteCdnAccessTokenResult';
  error?: Maybe<DeleteCdnAccessTokenError>;
  ok?: Maybe<DeleteCdnAccessTokenOk>;
};

export type DeleteDocumentCollectionOkPayload = {
  __typename?: 'DeleteDocumentCollectionOkPayload';
  deletedId: Scalars['ID']['output'];
  updatedTarget: Target;
};

export type DeleteDocumentCollectionOperationOkPayload = {
  __typename?: 'DeleteDocumentCollectionOperationOkPayload';
  deletedId: Scalars['ID']['output'];
  updatedCollection: DocumentCollection;
  updatedTarget: Target;
};

/** @oneOf */
export type DeleteDocumentCollectionOperationResult = {
  __typename?: 'DeleteDocumentCollectionOperationResult';
  error?: Maybe<ModifyDocumentCollectionError>;
  ok?: Maybe<DeleteDocumentCollectionOperationOkPayload>;
};

/** @oneOf */
export type DeleteDocumentCollectionResult = {
  __typename?: 'DeleteDocumentCollectionResult';
  error?: Maybe<ModifyDocumentCollectionError>;
  ok?: Maybe<DeleteDocumentCollectionOkPayload>;
};

export type DeleteOidcIntegrationError = Error & {
  __typename?: 'DeleteOIDCIntegrationError';
  message: Scalars['String']['output'];
};

export type DeleteOidcIntegrationInput = {
  oidcIntegrationId: Scalars['ID']['input'];
};

export type DeleteOidcIntegrationOk = {
  __typename?: 'DeleteOIDCIntegrationOk';
  organization: Organization;
};

export type DeleteOidcIntegrationResult = {
  __typename?: 'DeleteOIDCIntegrationResult';
  error?: Maybe<DeleteOidcIntegrationError>;
  ok?: Maybe<DeleteOidcIntegrationOk>;
};

export type DeleteOrganizationInvitationError = Error & {
  __typename?: 'DeleteOrganizationInvitationError';
  message: Scalars['String']['output'];
};

export type DeleteOrganizationInvitationInput = {
  email: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
};

export type DeleteOrganizationInvitationResult = {
  __typename?: 'DeleteOrganizationInvitationResult';
  error?: Maybe<DeleteOrganizationInvitationError>;
  ok?: Maybe<OrganizationInvitation>;
};

export type DeletePersistedOperationPayload = {
  __typename?: 'DeletePersistedOperationPayload';
  deletedPersistedOperation: PersistedOperation;
  selector: PersistedOperationSelector;
};

export type DeleteProjectPayload = {
  __typename?: 'DeleteProjectPayload';
  deletedProject: Project;
  selector: ProjectSelector;
};

export type DeleteTargetPayload = {
  __typename?: 'DeleteTargetPayload';
  deletedTarget: Target;
  selector: TargetSelector;
};

export type DeleteTokensInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
  tokens: Array<Scalars['ID']['input']>;
};

export type DeleteTokensPayload = {
  __typename?: 'DeleteTokensPayload';
  deletedTokens: Array<Scalars['ID']['output']>;
  selector: TargetSelector;
};

export type DeletedSchemaLog = {
  __typename?: 'DeletedSchemaLog';
  date: Scalars['DateTime']['output'];
  deletedService: Scalars['String']['output'];
  id: Scalars['ID']['output'];
};

export type DisableExternalSchemaCompositionInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

/** @oneOf */
export type DisableExternalSchemaCompositionResult = {
  __typename?: 'DisableExternalSchemaCompositionResult';
  error?: Maybe<Scalars['String']['output']>;
  ok?: Maybe<Project>;
};

export type DocumentCollection = {
  __typename?: 'DocumentCollection';
  createdAt: Scalars['DateTime']['output'];
  createdBy: User;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  operations: DocumentCollectionOperationsConnection;
  updatedAt: Scalars['DateTime']['output'];
};


export type DocumentCollectionOperationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type DocumentCollectionConnection = {
  __typename?: 'DocumentCollectionConnection';
  edges: Array<DocumentCollectionEdge>;
  pageInfo: PageInfo;
};

export type DocumentCollectionEdge = {
  __typename?: 'DocumentCollectionEdge';
  cursor: Scalars['String']['output'];
  node: DocumentCollection;
};

export type DocumentCollectionOperation = {
  __typename?: 'DocumentCollectionOperation';
  collection: DocumentCollection;
  createdAt: Scalars['DateTime']['output'];
  headers?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  query: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  variables?: Maybe<Scalars['String']['output']>;
};

export type DocumentCollectionOperationEdge = {
  __typename?: 'DocumentCollectionOperationEdge';
  cursor: Scalars['String']['output'];
  node: DocumentCollectionOperation;
};

export type DocumentCollectionOperationsConnection = {
  __typename?: 'DocumentCollectionOperationsConnection';
  edges: Array<DocumentCollectionOperationEdge>;
  pageInfo: PageInfo;
};

export type DowngradeToHobbyInput = {
  organization: OrganizationSelectorInput;
};

export type DurationHistogram = {
  __typename?: 'DurationHistogram';
  count: Scalars['SafeInt']['output'];
  duration: Scalars['Int']['output'];
};

export type DurationOverTime = {
  __typename?: 'DurationOverTime';
  date: Scalars['DateTime']['output'];
  duration: DurationStats;
};

export type DurationStats = {
  __typename?: 'DurationStats';
  p75: Scalars['Int']['output'];
  p90: Scalars['Int']['output'];
  p95: Scalars['Int']['output'];
  p99: Scalars['Int']['output'];
};

export type EnableExternalSchemaCompositionError = Error & {
  __typename?: 'EnableExternalSchemaCompositionError';
  /** The detailed validation error messages for the input fields. */
  inputErrors: EnableExternalSchemaCompositionInputErrors;
  message: Scalars['String']['output'];
};

export type EnableExternalSchemaCompositionInput = {
  endpoint: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  secret: Scalars['String']['input'];
};

export type EnableExternalSchemaCompositionInputErrors = {
  __typename?: 'EnableExternalSchemaCompositionInputErrors';
  endpoint?: Maybe<Scalars['String']['output']>;
  secret?: Maybe<Scalars['String']['output']>;
};

/** @oneOf */
export type EnableExternalSchemaCompositionResult = {
  __typename?: 'EnableExternalSchemaCompositionResult';
  error?: Maybe<EnableExternalSchemaCompositionError>;
  ok?: Maybe<Project>;
};

export type Error = {
  message: Scalars['String']['output'];
};

export type ExternalSchemaComposition = {
  __typename?: 'ExternalSchemaComposition';
  endpoint: Scalars['String']['output'];
};

/** A failed schema check. */
export type FailedSchemaCheck = SchemaCheck & {
  __typename?: 'FailedSchemaCheck';
  breakingSchemaChanges?: Maybe<SchemaChangeConnection>;
  compositeSchemaSDL?: Maybe<Scalars['String']['output']>;
  compositionErrors?: Maybe<SchemaErrorConnection>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Meta information about the schema check. */
  meta?: Maybe<SchemaCheckMeta>;
  safeSchemaChanges?: Maybe<SchemaChangeConnection>;
  schemaPolicyErrors?: Maybe<SchemaPolicyWarningConnection>;
  schemaPolicyWarnings?: Maybe<SchemaPolicyWarningConnection>;
  /** The SDL of the schema that was checked. */
  schemaSDL: Scalars['String']['output'];
  /**
   * The schema version against this check was performed.
   * Is null if there is no schema version published yet.
   */
  schemaVersion?: Maybe<SchemaVersion>;
  /** The name of the service that owns the schema. Is null for non composite project types. */
  serviceName?: Maybe<Scalars['String']['output']>;
  supergraphSDL?: Maybe<Scalars['String']['output']>;
  /** The URL of the schema check on the Hive Web App. */
  webUrl?: Maybe<Scalars['String']['output']>;
};

export type FailuresOverTime = {
  __typename?: 'FailuresOverTime';
  date: Scalars['DateTime']['output'];
  value: Scalars['SafeInt']['output'];
};

export type FieldListStatsInput = {
  fields: Array<FieldTypePairInput>;
  operationHash?: InputMaybe<Scalars['String']['input']>;
  organization: Scalars['String']['input'];
  period: DateRangeInput;
  project: Scalars['String']['input'];
  target: Scalars['String']['input'];
};

export type FieldStats = {
  __typename?: 'FieldStats';
  argument?: Maybe<Scalars['String']['output']>;
  count: Scalars['SafeInt']['output'];
  field: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
  type: Scalars['String']['output'];
};

export type FieldStatsInput = {
  argument?: InputMaybe<Scalars['String']['input']>;
  field: Scalars['String']['input'];
  operationHash?: InputMaybe<Scalars['String']['input']>;
  organization: Scalars['String']['input'];
  period: DateRangeInput;
  project: Scalars['String']['input'];
  target: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

export type FieldTypePairInput = {
  argument?: InputMaybe<Scalars['String']['input']>;
  field: Scalars['String']['input'];
  type: Scalars['String']['input'];
};

export type GitHubIntegration = {
  __typename?: 'GitHubIntegration';
  repositories: Array<GitHubRepository>;
};

export type GitHubRepository = {
  __typename?: 'GitHubRepository';
  nameWithOwner: Scalars['String']['output'];
};

export type GitHubSchemaCheckError = {
  __typename?: 'GitHubSchemaCheckError';
  message: Scalars['String']['output'];
};

export type GitHubSchemaCheckInput = {
  commit: Scalars['String']['input'];
};

export type GitHubSchemaCheckSuccess = {
  __typename?: 'GitHubSchemaCheckSuccess';
  message: Scalars['String']['output'];
};

export type GitHubSchemaPublishError = {
  __typename?: 'GitHubSchemaPublishError';
  message: Scalars['String']['output'];
};

export type GitHubSchemaPublishSuccess = {
  __typename?: 'GitHubSchemaPublishSuccess';
  message: Scalars['String']['output'];
};

export type GraphQlArgument = {
  __typename?: 'GraphQLArgument';
  defaultValue?: Maybe<Scalars['String']['output']>;
  deprecationReason?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  isDeprecated: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
  usage: SchemaCoordinateUsage;
};

export type GraphQlEnumType = {
  __typename?: 'GraphQLEnumType';
  description?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available.
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
  values: Array<GraphQlEnumValue>;
};

export type GraphQlEnumValue = {
  __typename?: 'GraphQLEnumValue';
  deprecationReason?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  isDeprecated: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available.
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type GraphQlField = {
  __typename?: 'GraphQLField';
  args: Array<GraphQlArgument>;
  deprecationReason?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  isDeprecated: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available.
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  type: Scalars['String']['output'];
  usage: SchemaCoordinateUsage;
};

export type GraphQlInputField = {
  __typename?: 'GraphQLInputField';
  defaultValue?: Maybe<Scalars['String']['output']>;
  deprecationReason?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  isDeprecated: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available (e.g. this is not an apollo federation project).
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  type: Scalars['String']['output'];
  usage: SchemaCoordinateUsage;
};

export type GraphQlInputObjectType = {
  __typename?: 'GraphQLInputObjectType';
  description?: Maybe<Scalars['String']['output']>;
  fields: Array<GraphQlInputField>;
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available (e.g. this is not an apollo federation project).
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type GraphQlInterfaceType = {
  __typename?: 'GraphQLInterfaceType';
  description?: Maybe<Scalars['String']['output']>;
  fields: Array<GraphQlField>;
  interfaces: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available.
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type GraphQlNamedType = GraphQlEnumType | GraphQlInputObjectType | GraphQlInterfaceType | GraphQlObjectType | GraphQlScalarType | GraphQlUnionType;

export type GraphQlObjectType = {
  __typename?: 'GraphQLObjectType';
  description?: Maybe<Scalars['String']['output']>;
  fields: Array<GraphQlField>;
  interfaces: Array<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available (e.g. this is not an apollo federation project).
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type GraphQlScalarType = {
  __typename?: 'GraphQLScalarType';
  description?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available (e.g. this is not an apollo federation project).
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type GraphQlUnionType = {
  __typename?: 'GraphQLUnionType';
  description?: Maybe<Scalars['String']['output']>;
  members: Array<GraphQlUnionTypeMember>;
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available (e.g. this is not an apollo federation project).
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type GraphQlUnionTypeMember = {
  __typename?: 'GraphQLUnionTypeMember';
  name: Scalars['String']['output'];
  /**
   * Metadata specific to Apollo Federation Projects.
   * Is null if no meta information is available (e.g. this is not an apollo federation project).
   */
  supergraphMetadata?: Maybe<SupergraphMetadata>;
  usage: SchemaCoordinateUsage;
};

export type InviteToOrganizationByEmailError = Error & {
  __typename?: 'InviteToOrganizationByEmailError';
  /** The detailed validation error messages for the input fields. */
  inputErrors: InviteToOrganizationByEmailInputErrors;
  message: Scalars['String']['output'];
};

export type InviteToOrganizationByEmailInput = {
  email: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
};

export type InviteToOrganizationByEmailInputErrors = {
  __typename?: 'InviteToOrganizationByEmailInputErrors';
  email?: Maybe<Scalars['String']['output']>;
};

/** @oneOf */
export type InviteToOrganizationByEmailResult = {
  __typename?: 'InviteToOrganizationByEmailResult';
  error?: Maybe<InviteToOrganizationByEmailError>;
  ok?: Maybe<OrganizationInvitation>;
};

export type JoinOrganizationPayload = OrganizationInvitationError | OrganizationPayload;

export type Lab = {
  __typename?: 'Lab';
  mocks?: Maybe<Scalars['JSON']['output']>;
  schema: Scalars['String']['output'];
};

export type Member = {
  __typename?: 'Member';
  id: Scalars['ID']['output'];
  isOwner: Scalars['Boolean']['output'];
  organizationAccessScopes: Array<OrganizationAccessScope>;
  projectAccessScopes: Array<ProjectAccessScope>;
  targetAccessScopes: Array<TargetAccessScope>;
  user: User;
};

export type MemberAddedActivity = Activity & {
  __typename?: 'MemberAddedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  type: Scalars['String']['output'];
  user: User;
};

export type MemberConnection = {
  __typename?: 'MemberConnection';
  nodes: Array<Member>;
  total: Scalars['Int']['output'];
};

export type MemberDeletedActivity = Activity & {
  __typename?: 'MemberDeletedActivity';
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  type: Scalars['String']['output'];
  user: User;
};

export type ModifyDocumentCollectionError = Error & {
  __typename?: 'ModifyDocumentCollectionError';
  message: Scalars['String']['output'];
};

export type ModifyDocumentCollectionOkPayload = {
  __typename?: 'ModifyDocumentCollectionOkPayload';
  collection: DocumentCollection;
  updatedTarget: Target;
};

export type ModifyDocumentCollectionOperationOkPayload = {
  __typename?: 'ModifyDocumentCollectionOperationOkPayload';
  collection: DocumentCollection;
  operation: DocumentCollectionOperation;
  updatedTarget: Target;
};

/** @oneOf */
export type ModifyDocumentCollectionOperationResult = {
  __typename?: 'ModifyDocumentCollectionOperationResult';
  error?: Maybe<ModifyDocumentCollectionError>;
  ok?: Maybe<ModifyDocumentCollectionOperationOkPayload>;
};

/** @oneOf */
export type ModifyDocumentCollectionResult = {
  __typename?: 'ModifyDocumentCollectionResult';
  error?: Maybe<ModifyDocumentCollectionError>;
  ok?: Maybe<ModifyDocumentCollectionOkPayload>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addAlert: AddAlertResult;
  addAlertChannel: AddAlertChannelResult;
  addGitHubIntegration: Scalars['Boolean']['output'];
  addSlackIntegration: Scalars['Boolean']['output'];
  answerOrganizationTransferRequest: AnswerOrganizationTransferRequestResult;
  createCdnAccessToken: CdnAccessTokenCreateResult;
  createDocumentCollection: ModifyDocumentCollectionResult;
  createOIDCIntegration: CreateOidcIntegrationResult;
  createOperationInDocumentCollection: ModifyDocumentCollectionOperationResult;
  createOrganization: CreateOrganizationResult;
  createProject: CreateProjectResult;
  createTarget: CreateTargetResult;
  createToken: CreateTokenResult;
  deleteAlertChannels: DeleteAlertChannelsResult;
  deleteAlerts: DeleteAlertsResult;
  deleteCdnAccessToken: DeleteCdnAccessTokenResult;
  deleteDocumentCollection: DeleteDocumentCollectionResult;
  deleteGitHubIntegration: Scalars['Boolean']['output'];
  deleteOIDCIntegration: DeleteOidcIntegrationResult;
  deleteOperationInDocumentCollection: DeleteDocumentCollectionOperationResult;
  deleteOrganization: OrganizationPayload;
  deleteOrganizationInvitation: DeleteOrganizationInvitationResult;
  deleteOrganizationMembers: OrganizationPayload;
  /** Requires API Token */
  deletePersistedOperation: DeletePersistedOperationPayload;
  deleteProject: DeleteProjectPayload;
  deleteSlackIntegration: Scalars['Boolean']['output'];
  deleteTarget: DeleteTargetPayload;
  deleteTokens: DeleteTokensPayload;
  disableExternalSchemaComposition: DisableExternalSchemaCompositionResult;
  downgradeToHobby: ChangePlanResult;
  enableExternalSchemaComposition: EnableExternalSchemaCompositionResult;
  generateStripePortalLink: Scalars['String']['output'];
  inviteToOrganizationByEmail: InviteToOrganizationByEmailResult;
  joinOrganization: JoinOrganizationPayload;
  noop?: Maybe<Scalars['Boolean']['output']>;
  /** Requires API Token */
  publishPersistedOperations: PublishPersistedOperationPayload;
  requestOrganizationTransfer: RequestOrganizationTransferResult;
  /** Requires API Token */
  schemaCheck: SchemaCheckPayload;
  /** Requires API Token */
  schemaDelete: SchemaDeleteResult;
  /** Requires API Token */
  schemaPublish: SchemaPublishPayload;
  sendFeedback: Scalars['Boolean']['output'];
  setTargetValidation: Target;
  updateBaseSchema: UpdateBaseSchemaResult;
  updateDocumentCollection: ModifyDocumentCollectionResult;
  updateMe: UpdateMeResult;
  updateOIDCIntegration: UpdateOidcIntegrationResult;
  updateOperationInDocumentCollection: ModifyDocumentCollectionOperationResult;
  updateOrgRateLimit: Organization;
  updateOrganizationMemberAccess: OrganizationPayload;
  updateOrganizationName: UpdateOrganizationNameResult;
  updateProjectGitRepository: UpdateProjectGitRepositoryResult;
  updateProjectName: UpdateProjectNameResult;
  updateProjectRegistryModel: UpdateProjectRegistryModelResult;
  updateSchemaPolicyForOrganization: UpdateSchemaPolicyResult;
  updateSchemaPolicyForProject: UpdateSchemaPolicyResult;
  updateSchemaVersionStatus: SchemaVersion;
  updateTargetName: UpdateTargetNameResult;
  updateTargetValidationSettings: UpdateTargetValidationSettingsResult;
  upgradeToPro: ChangePlanResult;
};


export type MutationAddAlertArgs = {
  input: AddAlertInput;
};


export type MutationAddAlertChannelArgs = {
  input: AddAlertChannelInput;
};


export type MutationAddGitHubIntegrationArgs = {
  input: AddGitHubIntegrationInput;
};


export type MutationAddSlackIntegrationArgs = {
  input: AddSlackIntegrationInput;
};


export type MutationAnswerOrganizationTransferRequestArgs = {
  input: AnswerOrganizationTransferRequestInput;
};


export type MutationCreateCdnAccessTokenArgs = {
  input: CreateCdnAccessTokenInput;
};


export type MutationCreateDocumentCollectionArgs = {
  input: CreateDocumentCollectionInput;
  selector: TargetSelectorInput;
};


export type MutationCreateOidcIntegrationArgs = {
  input: CreateOidcIntegrationInput;
};


export type MutationCreateOperationInDocumentCollectionArgs = {
  input: CreateDocumentCollectionOperationInput;
  selector: TargetSelectorInput;
};


export type MutationCreateOrganizationArgs = {
  input: CreateOrganizationInput;
};


export type MutationCreateProjectArgs = {
  input: CreateProjectInput;
};


export type MutationCreateTargetArgs = {
  input: CreateTargetInput;
};


export type MutationCreateTokenArgs = {
  input: CreateTokenInput;
};


export type MutationDeleteAlertChannelsArgs = {
  input: DeleteAlertChannelsInput;
};


export type MutationDeleteAlertsArgs = {
  input: DeleteAlertsInput;
};


export type MutationDeleteCdnAccessTokenArgs = {
  input: DeleteCdnAccessTokenInput;
};


export type MutationDeleteDocumentCollectionArgs = {
  id: Scalars['ID']['input'];
  selector: TargetSelectorInput;
};


export type MutationDeleteGitHubIntegrationArgs = {
  input: OrganizationSelectorInput;
};


export type MutationDeleteOidcIntegrationArgs = {
  input: DeleteOidcIntegrationInput;
};


export type MutationDeleteOperationInDocumentCollectionArgs = {
  id: Scalars['ID']['input'];
  selector: TargetSelectorInput;
};


export type MutationDeleteOrganizationArgs = {
  selector: OrganizationSelectorInput;
};


export type MutationDeleteOrganizationInvitationArgs = {
  input: DeleteOrganizationInvitationInput;
};


export type MutationDeleteOrganizationMembersArgs = {
  selector: OrganizationMembersSelectorInput;
};


export type MutationDeletePersistedOperationArgs = {
  selector: PersistedOperationSelectorInput;
};


export type MutationDeleteProjectArgs = {
  selector: ProjectSelectorInput;
};


export type MutationDeleteSlackIntegrationArgs = {
  input: OrganizationSelectorInput;
};


export type MutationDeleteTargetArgs = {
  selector: TargetSelectorInput;
};


export type MutationDeleteTokensArgs = {
  input: DeleteTokensInput;
};


export type MutationDisableExternalSchemaCompositionArgs = {
  input: DisableExternalSchemaCompositionInput;
};


export type MutationDowngradeToHobbyArgs = {
  input: DowngradeToHobbyInput;
};


export type MutationEnableExternalSchemaCompositionArgs = {
  input: EnableExternalSchemaCompositionInput;
};


export type MutationGenerateStripePortalLinkArgs = {
  selector: OrganizationSelectorInput;
};


export type MutationInviteToOrganizationByEmailArgs = {
  input: InviteToOrganizationByEmailInput;
};


export type MutationJoinOrganizationArgs = {
  code: Scalars['String']['input'];
};


export type MutationPublishPersistedOperationsArgs = {
  input: Array<PublishPersistedOperationInput>;
};


export type MutationRequestOrganizationTransferArgs = {
  input: RequestOrganizationTransferInput;
};


export type MutationSchemaCheckArgs = {
  input: SchemaCheckInput;
};


export type MutationSchemaDeleteArgs = {
  input: SchemaDeleteInput;
};


export type MutationSchemaPublishArgs = {
  input: SchemaPublishInput;
};


export type MutationSendFeedbackArgs = {
  feedback: Scalars['String']['input'];
};


export type MutationSetTargetValidationArgs = {
  input: SetTargetValidationInput;
};


export type MutationUpdateBaseSchemaArgs = {
  input: UpdateBaseSchemaInput;
};


export type MutationUpdateDocumentCollectionArgs = {
  input: UpdateDocumentCollectionInput;
  selector: TargetSelectorInput;
};


export type MutationUpdateMeArgs = {
  input: UpdateMeInput;
};


export type MutationUpdateOidcIntegrationArgs = {
  input: UpdateOidcIntegrationInput;
};


export type MutationUpdateOperationInDocumentCollectionArgs = {
  input: UpdateDocumentCollectionOperationInput;
  selector: TargetSelectorInput;
};


export type MutationUpdateOrgRateLimitArgs = {
  monthlyLimits: RateLimitInput;
  selector: OrganizationSelectorInput;
};


export type MutationUpdateOrganizationMemberAccessArgs = {
  input: OrganizationMemberAccessInput;
};


export type MutationUpdateOrganizationNameArgs = {
  input: UpdateOrganizationNameInput;
};


export type MutationUpdateProjectGitRepositoryArgs = {
  input: UpdateProjectGitRepositoryInput;
};


export type MutationUpdateProjectNameArgs = {
  input: UpdateProjectNameInput;
};


export type MutationUpdateProjectRegistryModelArgs = {
  input: UpdateProjectRegistryModelInput;
};


export type MutationUpdateSchemaPolicyForOrganizationArgs = {
  allowOverrides: Scalars['Boolean']['input'];
  policy: SchemaPolicyInput;
  selector: OrganizationSelectorInput;
};


export type MutationUpdateSchemaPolicyForProjectArgs = {
  policy: SchemaPolicyInput;
  selector: ProjectSelectorInput;
};


export type MutationUpdateSchemaVersionStatusArgs = {
  input: SchemaVersionUpdateInput;
};


export type MutationUpdateTargetNameArgs = {
  input: UpdateTargetNameInput;
};


export type MutationUpdateTargetValidationSettingsArgs = {
  input: UpdateTargetValidationSettingsInput;
};


export type MutationUpgradeToProArgs = {
  input: UpgradeToProInput;
};

export type OidcIntegration = {
  __typename?: 'OIDCIntegration';
  authorizationEndpoint: Scalars['String']['output'];
  clientId: Scalars['ID']['output'];
  clientSecretPreview: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  tokenEndpoint: Scalars['String']['output'];
  userinfoEndpoint: Scalars['String']['output'];
};

export type OperationBodyByHashInput = {
  hash: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type OperationStats = {
  __typename?: 'OperationStats';
  /** Total number of requests */
  count: Scalars['SafeInt']['output'];
  /** Number of requests that succeeded */
  countOk: Scalars['SafeInt']['output'];
  duration: DurationStats;
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  name: Scalars['String']['output'];
  operationHash?: Maybe<Scalars['String']['output']>;
  percentage: Scalars['Float']['output'];
};

export type OperationStatsConnection = {
  __typename?: 'OperationStatsConnection';
  nodes: Array<OperationStats>;
  total: Scalars['Int']['output'];
};

export type OperationsStats = {
  __typename?: 'OperationsStats';
  clients: ClientStatsConnection;
  duration: DurationStats;
  durationHistogram: Array<DurationHistogram>;
  durationOverTime: Array<DurationOverTime>;
  failuresOverTime: Array<FailuresOverTime>;
  operations: OperationStatsConnection;
  requestsOverTime: Array<RequestsOverTime>;
  totalFailures: Scalars['SafeInt']['output'];
  totalOperations: Scalars['Int']['output'];
  totalRequests: Scalars['SafeInt']['output'];
};


export type OperationsStatsDurationHistogramArgs = {
  resolution: Scalars['Int']['input'];
};


export type OperationsStatsDurationOverTimeArgs = {
  resolution: Scalars['Int']['input'];
};


export type OperationsStatsFailuresOverTimeArgs = {
  resolution: Scalars['Int']['input'];
};


export type OperationsStatsRequestsOverTimeArgs = {
  resolution: Scalars['Int']['input'];
};

export type OperationsStatsSelectorInput = {
  clientNames?: InputMaybe<Array<Scalars['String']['input']>>;
  operations?: InputMaybe<Array<Scalars['ID']['input']>>;
  organization: Scalars['ID']['input'];
  period: DateRangeInput;
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type Organization = {
  __typename?: 'Organization';
  billingConfiguration: BillingConfiguration;
  cleanId: Scalars['ID']['output'];
  getStarted: OrganizationGetStarted;
  id: Scalars['ID']['output'];
  invitations: OrganizationInvitationConnection;
  me: Member;
  members: MemberConnection;
  name: Scalars['String']['output'];
  oidcIntegration?: Maybe<OidcIntegration>;
  owner: Member;
  plan: BillingPlanType;
  projects: ProjectConnection;
  rateLimit: RateLimit;
  schemaPolicy?: Maybe<SchemaPolicy>;
  viewerCanManageOIDCIntegration: Scalars['Boolean']['output'];
};

export enum OrganizationAccessScope {
  Delete = 'DELETE',
  Integrations = 'INTEGRATIONS',
  Members = 'MEMBERS',
  Read = 'READ',
  Settings = 'SETTINGS'
}

export type OrganizationActivitiesSelector = {
  limit: Scalars['Int']['input'];
  organization: Scalars['ID']['input'];
};

export type OrganizationByInviteCodePayload = OrganizationInvitationError | OrganizationInvitationPayload;

export type OrganizationConnection = {
  __typename?: 'OrganizationConnection';
  nodes: Array<Organization>;
  total: Scalars['Int']['output'];
};

export type OrganizationCreatedActivity = Activity & {
  __typename?: 'OrganizationCreatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  type: Scalars['String']['output'];
  user: User;
};

export type OrganizationGetStarted = {
  __typename?: 'OrganizationGetStarted';
  checkingSchema: Scalars['Boolean']['output'];
  creatingProject: Scalars['Boolean']['output'];
  enablingUsageBasedBreakingChanges: Scalars['Boolean']['output'];
  invitingMembers: Scalars['Boolean']['output'];
  publishingSchema: Scalars['Boolean']['output'];
  reportingOperations: Scalars['Boolean']['output'];
};

export type OrganizationIdUpdatedActivity = Activity & {
  __typename?: 'OrganizationIdUpdatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  type: Scalars['String']['output'];
  user: User;
  value: Scalars['String']['output'];
};

export type OrganizationInvitation = {
  __typename?: 'OrganizationInvitation';
  code: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
};

export type OrganizationInvitationConnection = {
  __typename?: 'OrganizationInvitationConnection';
  nodes: Array<OrganizationInvitation>;
  total: Scalars['Int']['output'];
};

export type OrganizationInvitationError = {
  __typename?: 'OrganizationInvitationError';
  message: Scalars['String']['output'];
};

export type OrganizationInvitationPayload = {
  __typename?: 'OrganizationInvitationPayload';
  name: Scalars['String']['output'];
};

export type OrganizationMemberAccessInput = {
  organization: Scalars['ID']['input'];
  organizationScopes: Array<OrganizationAccessScope>;
  projectScopes: Array<ProjectAccessScope>;
  targetScopes: Array<TargetAccessScope>;
  user: Scalars['ID']['input'];
};

export type OrganizationMembersSelectorInput = {
  organization: Scalars['ID']['input'];
  users: Array<Scalars['ID']['input']>;
};

export type OrganizationNameUpdatedActivity = Activity & {
  __typename?: 'OrganizationNameUpdatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  type: Scalars['String']['output'];
  user: User;
  value: Scalars['String']['output'];
};

export type OrganizationPayload = {
  __typename?: 'OrganizationPayload';
  organization: Organization;
  selector: OrganizationSelector;
};

export type OrganizationPlanChangeActivity = Activity & {
  __typename?: 'OrganizationPlanChangeActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  newPlan: BillingPlanType;
  organization: Organization;
  previousPlan: BillingPlanType;
  type: Scalars['String']['output'];
  user: User;
};

export type OrganizationSelector = {
  __typename?: 'OrganizationSelector';
  organization: Scalars['ID']['output'];
};

export type OrganizationSelectorInput = {
  organization: Scalars['ID']['input'];
};

export type OrganizationTransfer = {
  __typename?: 'OrganizationTransfer';
  organization: Organization;
};

export type OrganizationTransferRequestSelector = {
  code: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor: Scalars['String']['output'];
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Scalars['String']['output'];
};

export type PersistedOperation = {
  __typename?: 'PersistedOperation';
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  name: Scalars['String']['output'];
  operationHash: Scalars['ID']['output'];
};

export type PersistedOperationConnection = {
  __typename?: 'PersistedOperationConnection';
  nodes: Array<PersistedOperation>;
  total: Scalars['Int']['output'];
};

export type PersistedOperationSelector = {
  __typename?: 'PersistedOperationSelector';
  operation?: Maybe<Scalars['ID']['output']>;
  organization: Scalars['ID']['output'];
  project: Scalars['ID']['output'];
};

export type PersistedOperationSelectorInput = {
  operation: Scalars['ID']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type Project = {
  __typename?: 'Project';
  alertChannels: Array<AlertChannel>;
  alerts: Array<Alert>;
  buildUrl?: Maybe<Scalars['String']['output']>;
  cleanId: Scalars['ID']['output'];
  externalSchemaComposition?: Maybe<ExternalSchemaComposition>;
  gitRepository?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  persistedOperations: PersistedOperationConnection;
  registryModel: RegistryModel;
  requestsOverTime: Array<RequestsOverTime>;
  schemaPolicy?: Maybe<SchemaPolicy>;
  schemaVersionsCount: Scalars['Int']['output'];
  targets: TargetConnection;
  type: ProjectType;
  validationUrl?: Maybe<Scalars['String']['output']>;
};


export type ProjectRequestsOverTimeArgs = {
  period: DateRangeInput;
  resolution: Scalars['Int']['input'];
};


export type ProjectSchemaVersionsCountArgs = {
  period?: InputMaybe<DateRangeInput>;
};

export enum ProjectAccessScope {
  Alerts = 'ALERTS',
  Delete = 'DELETE',
  OperationsStoreRead = 'OPERATIONS_STORE_READ',
  OperationsStoreWrite = 'OPERATIONS_STORE_WRITE',
  Read = 'READ',
  Settings = 'SETTINGS'
}

export type ProjectActivitiesSelector = {
  limit: Scalars['Int']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type ProjectConnection = {
  __typename?: 'ProjectConnection';
  nodes: Array<Project>;
  total: Scalars['Int']['output'];
};

export type ProjectCreatedActivity = Activity & {
  __typename?: 'ProjectCreatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  project: Project;
  type: Scalars['String']['output'];
  user: User;
};

export type ProjectDeletedActivity = Activity & {
  __typename?: 'ProjectDeletedActivity';
  cleanId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  organization: Organization;
  type: Scalars['String']['output'];
  user: User;
};

export type ProjectIdUpdatedActivity = Activity & {
  __typename?: 'ProjectIdUpdatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  project: Project;
  type: Scalars['String']['output'];
  user: User;
  value: Scalars['String']['output'];
};

export type ProjectNameUpdatedActivity = Activity & {
  __typename?: 'ProjectNameUpdatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  project: Project;
  type: Scalars['String']['output'];
  user: User;
  value: Scalars['String']['output'];
};

export type ProjectSelector = {
  __typename?: 'ProjectSelector';
  organization: Scalars['ID']['output'];
  project: Scalars['ID']['output'];
};

export type ProjectSelectorInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export enum ProjectType {
  Federation = 'FEDERATION',
  Single = 'SINGLE',
  Stitching = 'STITCHING'
}

export type PublishPersistedOperationInput = {
  content: Scalars['String']['input'];
  operationHash?: InputMaybe<Scalars['String']['input']>;
};

export type PublishPersistedOperationPayload = {
  __typename?: 'PublishPersistedOperationPayload';
  operations: Array<PersistedOperation>;
  summary: PublishPersistedOperationsSummary;
};

export type PublishPersistedOperationsSummary = {
  __typename?: 'PublishPersistedOperationsSummary';
  total: Scalars['Int']['output'];
  unchanged: Scalars['Int']['output'];
};

export type PushedSchemaLog = {
  __typename?: 'PushedSchemaLog';
  author: Scalars['String']['output'];
  commit: Scalars['ID']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  service?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  admin: AdminQuery;
  billingPlans: Array<BillingPlan>;
  clientStatsByTargets: ClientStatsConnection;
  /** Requires API Token */
  comparePersistedOperations: Array<Scalars['String']['output']>;
  fieldListStats: Array<FieldStats>;
  fieldStats: FieldStats;
  gitHubIntegration: GitHubIntegration;
  hasCollectedOperations: Scalars['Boolean']['output'];
  hasGitHubIntegration: Scalars['Boolean']['output'];
  hasSlackIntegration: Scalars['Boolean']['output'];
  /** Whether the CDN integration in Hive is enabled. */
  isCDNEnabled: Scalars['Boolean']['output'];
  isGitHubIntegrationFeatureEnabled: Scalars['Boolean']['output'];
  lab?: Maybe<Lab>;
  /** Requires API Token */
  latestValidVersion?: Maybe<SchemaVersion>;
  /** Requires API Token */
  latestVersion?: Maybe<SchemaVersion>;
  me: User;
  noop?: Maybe<Scalars['Boolean']['output']>;
  operationBodyByHash?: Maybe<Scalars['String']['output']>;
  operationsStats: OperationsStats;
  organization?: Maybe<OrganizationPayload>;
  organizationActivities: ActivityConnection;
  organizationByGitHubInstallationId?: Maybe<Organization>;
  organizationByInviteCode?: Maybe<OrganizationByInviteCodePayload>;
  organizationTransferRequest?: Maybe<OrganizationTransfer>;
  organizations: OrganizationConnection;
  persistedOperation?: Maybe<PersistedOperation>;
  persistedOperations: PersistedOperationConnection;
  project?: Maybe<Project>;
  projectActivities: ActivityConnection;
  projects: ProjectConnection;
  schemaCompareToPrevious: SchemaComparePayload;
  schemaPolicyRules: Array<SchemaPolicyRule>;
  schemaVersion: SchemaVersion;
  schemaVersions: SchemaVersionConnection;
  /** Requires API Token */
  storedOperations: Array<PersistedOperation>;
  target?: Maybe<Target>;
  targetActivities: ActivityConnection;
  targets: TargetConnection;
  testExternalSchemaComposition: TestExternalSchemaCompositionResult;
  tokenInfo: TokenInfoPayload;
  tokens: TokenConnection;
  usageEstimation: UsageEstimationScope;
};


export type QueryClientStatsByTargetsArgs = {
  selector: ClientStatsByTargetsInput;
};


export type QueryComparePersistedOperationsArgs = {
  hashes: Array<Scalars['String']['input']>;
};


export type QueryFieldListStatsArgs = {
  selector: FieldListStatsInput;
};


export type QueryFieldStatsArgs = {
  selector: FieldStatsInput;
};


export type QueryGitHubIntegrationArgs = {
  selector: OrganizationSelectorInput;
};


export type QueryHasCollectedOperationsArgs = {
  selector: TargetSelectorInput;
};


export type QueryHasGitHubIntegrationArgs = {
  selector: OrganizationSelectorInput;
};


export type QueryHasSlackIntegrationArgs = {
  selector: OrganizationSelectorInput;
};


export type QueryLabArgs = {
  selector: TargetSelectorInput;
};


export type QueryOperationBodyByHashArgs = {
  selector: OperationBodyByHashInput;
};


export type QueryOperationsStatsArgs = {
  selector: OperationsStatsSelectorInput;
};


export type QueryOrganizationArgs = {
  selector: OrganizationSelectorInput;
};


export type QueryOrganizationActivitiesArgs = {
  selector: OrganizationActivitiesSelector;
};


export type QueryOrganizationByGitHubInstallationIdArgs = {
  installation: Scalars['ID']['input'];
};


export type QueryOrganizationByInviteCodeArgs = {
  code: Scalars['String']['input'];
};


export type QueryOrganizationTransferRequestArgs = {
  selector: OrganizationTransferRequestSelector;
};


export type QueryPersistedOperationArgs = {
  selector: PersistedOperationSelectorInput;
};


export type QueryPersistedOperationsArgs = {
  selector: ProjectSelectorInput;
};


export type QueryProjectArgs = {
  selector: ProjectSelectorInput;
};


export type QueryProjectActivitiesArgs = {
  selector: ProjectActivitiesSelector;
};


export type QueryProjectsArgs = {
  selector: OrganizationSelectorInput;
};


export type QuerySchemaCompareToPreviousArgs = {
  selector: SchemaCompareToPreviousInput;
  unstable_forceLegacyComparison?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QuerySchemaVersionArgs = {
  selector: SchemaVersionInput;
};


export type QuerySchemaVersionsArgs = {
  after?: InputMaybe<Scalars['ID']['input']>;
  limit: Scalars['Int']['input'];
  selector: SchemaVersionsInput;
};


export type QueryTargetArgs = {
  selector: TargetSelectorInput;
};


export type QueryTargetActivitiesArgs = {
  selector: TargetActivitiesSelector;
};


export type QueryTargetsArgs = {
  selector: ProjectSelectorInput;
};


export type QueryTestExternalSchemaCompositionArgs = {
  selector: TestExternalSchemaCompositionInput;
};


export type QueryTokensArgs = {
  selector: TargetSelectorInput;
};


export type QueryUsageEstimationArgs = {
  range: DateRangeInput;
};

export type RateLimit = {
  __typename?: 'RateLimit';
  limitedForOperations: Scalars['Boolean']['output'];
  operations: Scalars['SafeInt']['output'];
  retentionInDays: Scalars['Int']['output'];
};

export type RateLimitInput = {
  operations: Scalars['SafeInt']['input'];
};

export type RegistryLog = DeletedSchemaLog | PushedSchemaLog;

export enum RegistryModel {
  Legacy = 'LEGACY',
  Modern = 'MODERN'
}

export type RequestOrganizationTransferError = Error & {
  __typename?: 'RequestOrganizationTransferError';
  message: Scalars['String']['output'];
};

export type RequestOrganizationTransferInput = {
  organization: Scalars['ID']['input'];
  user: Scalars['ID']['input'];
};

export type RequestOrganizationTransferOk = {
  __typename?: 'RequestOrganizationTransferOk';
  code: Scalars['String']['output'];
  email: Scalars['String']['output'];
};

/** @oneOf */
export type RequestOrganizationTransferResult = {
  __typename?: 'RequestOrganizationTransferResult';
  error?: Maybe<RequestOrganizationTransferError>;
  ok?: Maybe<RequestOrganizationTransferOk>;
};

export type RequestsOverTime = {
  __typename?: 'RequestsOverTime';
  date: Scalars['DateTime']['output'];
  value: Scalars['SafeInt']['output'];
};

export enum RuleInstanceSeverityLevel {
  Error = 'ERROR',
  Off = 'OFF',
  Warning = 'WARNING'
}

export type Schema = CompositeSchema | SingleSchema;

export type SchemaChange = {
  __typename?: 'SchemaChange';
  criticality: CriticalityLevel;
  criticalityReason?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  path?: Maybe<Array<Scalars['String']['output']>>;
};

export type SchemaChangeConnection = {
  __typename?: 'SchemaChangeConnection';
  nodes: Array<SchemaChange>;
  total: Scalars['Int']['output'];
};

export type SchemaCheck = {
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Meta information about the schema check. */
  meta?: Maybe<SchemaCheckMeta>;
  /** The SDL of the schema that was checked. */
  schemaSDL: Scalars['String']['output'];
  /**
   * The schema version against this check was performed.
   * Is null if there is no schema version published yet.
   */
  schemaVersion?: Maybe<SchemaVersion>;
  /** The name of the service that owns the schema. Is null for non composite project types. */
  serviceName?: Maybe<Scalars['String']['output']>;
  /** The URL of the schema check on the Hive Web App. */
  webUrl?: Maybe<Scalars['String']['output']>;
};

export type SchemaCheckConnection = {
  __typename?: 'SchemaCheckConnection';
  edges: Array<SchemaCheckEdge>;
  pageInfo: PageInfo;
};

export type SchemaCheckEdge = {
  __typename?: 'SchemaCheckEdge';
  cursor: Scalars['String']['output'];
  node: SchemaCheck;
};

export type SchemaCheckError = {
  __typename?: 'SchemaCheckError';
  changes?: Maybe<SchemaChangeConnection>;
  errors: SchemaErrorConnection;
  schemaCheck?: Maybe<SchemaCheck>;
  valid: Scalars['Boolean']['output'];
  warnings?: Maybe<SchemaWarningConnection>;
};

export type SchemaCheckInput = {
  github?: InputMaybe<GitHubSchemaCheckInput>;
  meta?: InputMaybe<SchemaCheckMetaInput>;
  sdl: Scalars['String']['input'];
  service?: InputMaybe<Scalars['ID']['input']>;
};

export type SchemaCheckMeta = {
  __typename?: 'SchemaCheckMeta';
  author: Scalars['String']['output'];
  commit: Scalars['String']['output'];
};

export type SchemaCheckMetaInput = {
  author: Scalars['String']['input'];
  commit: Scalars['String']['input'];
};

export type SchemaCheckPayload = GitHubSchemaCheckError | GitHubSchemaCheckSuccess | SchemaCheckError | SchemaCheckSuccess;

export type SchemaCheckSuccess = {
  __typename?: 'SchemaCheckSuccess';
  changes?: Maybe<SchemaChangeConnection>;
  initial: Scalars['Boolean']['output'];
  schemaCheck?: Maybe<SchemaCheck>;
  valid: Scalars['Boolean']['output'];
  warnings?: Maybe<SchemaWarningConnection>;
};

export type SchemaCheckWarning = {
  __typename?: 'SchemaCheckWarning';
  column?: Maybe<Scalars['Int']['output']>;
  line?: Maybe<Scalars['Int']['output']>;
  message: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
};

export type SchemaCompareError = {
  __typename?: 'SchemaCompareError';
  details?: Maybe<Array<SchemaCompareErrorDetail>>;
  /** @deprecated Use details instead. */
  message: Scalars['String']['output'];
};

export type SchemaCompareErrorDetail = {
  __typename?: 'SchemaCompareErrorDetail';
  message: Scalars['String']['output'];
  type: SchemaCompareErrorDetailType;
};

export enum SchemaCompareErrorDetailType {
  Composition = 'composition',
  Graphql = 'graphql',
  Policy = 'policy'
}

export type SchemaCompareInput = {
  after: Scalars['ID']['input'];
  before: Scalars['ID']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type SchemaComparePayload = SchemaCompareError | SchemaCompareResult;

export type SchemaCompareResult = {
  __typename?: 'SchemaCompareResult';
  changes: SchemaChangeConnection;
  diff: SchemaDiff;
  initial: Scalars['Boolean']['output'];
  service?: Maybe<ServiceSchemaDiff>;
};

export type SchemaCompareToPreviousInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
  version: Scalars['ID']['input'];
};

export type SchemaConnection = {
  __typename?: 'SchemaConnection';
  nodes: Array<Schema>;
  total: Scalars['Int']['output'];
};

export type SchemaCoordinateUsage = {
  __typename?: 'SchemaCoordinateUsage';
  isUsed: Scalars['Boolean']['output'];
  total: Scalars['Float']['output'];
  /**
   * A list of clients that use this schema coordinate within GraphQL operation documents.
   * Is null if used by none clients.
   */
  usedByClients?: Maybe<Array<Scalars['String']['output']>>;
};

export type SchemaDeleteError = {
  __typename?: 'SchemaDeleteError';
  errors: SchemaErrorConnection;
  valid: Scalars['Boolean']['output'];
};

export type SchemaDeleteInput = {
  dryRun?: InputMaybe<Scalars['Boolean']['input']>;
  serviceName: Scalars['ID']['input'];
};

export type SchemaDeleteResult = SchemaDeleteError | SchemaDeleteSuccess;

export type SchemaDeleteSuccess = {
  __typename?: 'SchemaDeleteSuccess';
  changes?: Maybe<SchemaChangeConnection>;
  errors: SchemaErrorConnection;
  valid: Scalars['Boolean']['output'];
};

export type SchemaDiff = {
  __typename?: 'SchemaDiff';
  after: Scalars['String']['output'];
  before?: Maybe<Scalars['String']['output']>;
};

export type SchemaError = {
  __typename?: 'SchemaError';
  message: Scalars['String']['output'];
  path?: Maybe<Array<Scalars['String']['output']>>;
};

export type SchemaErrorConnection = {
  __typename?: 'SchemaErrorConnection';
  nodes: Array<SchemaError>;
  total: Scalars['Int']['output'];
};

export type SchemaExplorer = {
  __typename?: 'SchemaExplorer';
  mutation?: Maybe<GraphQlObjectType>;
  query?: Maybe<GraphQlObjectType>;
  subscription?: Maybe<GraphQlObjectType>;
  type?: Maybe<GraphQlNamedType>;
  types: Array<GraphQlNamedType>;
};


export type SchemaExplorerTypeArgs = {
  name: Scalars['String']['input'];
};

export type SchemaExplorerUsageInput = {
  period: DateRangeInput;
};

export type SchemaPolicy = {
  __typename?: 'SchemaPolicy';
  allowOverrides: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  rules: Array<SchemaPolicyRuleInstance>;
  updatedAt: Scalars['DateTime']['output'];
};

export type SchemaPolicyInput = {
  rules: Array<SchemaPolicyRuleInstanceInput>;
};

export enum SchemaPolicyLevel {
  Organization = 'ORGANIZATION',
  Project = 'PROJECT'
}

export type SchemaPolicyRule = {
  __typename?: 'SchemaPolicyRule';
  configJsonSchema?: Maybe<Scalars['JSONSchemaObject']['output']>;
  description: Scalars['String']['output'];
  documentationUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  recommended: Scalars['Boolean']['output'];
};

export type SchemaPolicyRuleInstance = {
  __typename?: 'SchemaPolicyRuleInstance';
  configuration?: Maybe<Scalars['JSON']['output']>;
  rule: SchemaPolicyRule;
  severity: RuleInstanceSeverityLevel;
};

export type SchemaPolicyRuleInstanceInput = {
  configuration?: InputMaybe<Scalars['JSON']['input']>;
  ruleId: Scalars['String']['input'];
  severity: RuleInstanceSeverityLevel;
};

export type SchemaPolicyWarning = {
  __typename?: 'SchemaPolicyWarning';
  end?: Maybe<CodePosition>;
  message: Scalars['String']['output'];
  ruleId: Scalars['String']['output'];
  start: CodePosition;
};

export type SchemaPolicyWarningConnection = {
  __typename?: 'SchemaPolicyWarningConnection';
  edges: Array<SchemaPolicyWarningEdge>;
  pageInfo: PageInfo;
};

export type SchemaPolicyWarningEdge = {
  __typename?: 'SchemaPolicyWarningEdge';
  cursor: Scalars['String']['output'];
  node: SchemaPolicyWarning;
};

export type SchemaPublishError = {
  __typename?: 'SchemaPublishError';
  changes?: Maybe<SchemaChangeConnection>;
  errors: SchemaErrorConnection;
  linkToWebsite?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
};

export type SchemaPublishInput = {
  author: Scalars['String']['input'];
  commit: Scalars['String']['input'];
  /**
   * Accept breaking changes and mark schema as valid (if composable)
   * @deprecated Enabled by default for newly created projects
   */
  experimental_acceptBreakingChanges?: InputMaybe<Scalars['Boolean']['input']>;
  /** @deprecated Enabled by default for newly created projects */
  force?: InputMaybe<Scalars['Boolean']['input']>;
  /** Talk to GitHub Application and create a check-run */
  github?: InputMaybe<Scalars['Boolean']['input']>;
  metadata?: InputMaybe<Scalars['String']['input']>;
  sdl: Scalars['String']['input'];
  service?: InputMaybe<Scalars['ID']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};

export type SchemaPublishMissingServiceError = {
  __typename?: 'SchemaPublishMissingServiceError';
  message: Scalars['String']['output'];
};

export type SchemaPublishMissingUrlError = {
  __typename?: 'SchemaPublishMissingUrlError';
  message: Scalars['String']['output'];
};

export type SchemaPublishPayload = GitHubSchemaPublishError | GitHubSchemaPublishSuccess | SchemaPublishError | SchemaPublishMissingServiceError | SchemaPublishMissingUrlError | SchemaPublishSuccess;

export type SchemaPublishSuccess = {
  __typename?: 'SchemaPublishSuccess';
  changes?: Maybe<SchemaChangeConnection>;
  initial: Scalars['Boolean']['output'];
  linkToWebsite?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
};

export type SchemaVersion = {
  __typename?: 'SchemaVersion';
  baseSchema?: Maybe<Scalars['String']['output']>;
  date: Scalars['DateTime']['output'];
  errors: SchemaErrorConnection;
  /** Experimental: This field is not stable and may change in the future. */
  explorer: SchemaExplorer;
  id: Scalars['ID']['output'];
  log: RegistryLog;
  schemas: SchemaConnection;
  sdl?: Maybe<Scalars['String']['output']>;
  supergraph?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
};


export type SchemaVersionExplorerArgs = {
  usage?: InputMaybe<SchemaExplorerUsageInput>;
};

export type SchemaVersionConnection = {
  __typename?: 'SchemaVersionConnection';
  nodes: Array<SchemaVersion>;
  pageInfo: PageInfo;
};

export type SchemaVersionInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
  version: Scalars['ID']['input'];
};

export type SchemaVersionUpdateInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
  valid: Scalars['Boolean']['input'];
  version: Scalars['ID']['input'];
};

export type SchemaVersionsInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type SchemaWarningConnection = {
  __typename?: 'SchemaWarningConnection';
  nodes: Array<SchemaCheckWarning>;
  total: Scalars['Int']['output'];
};

export type ServiceSchemaDiff = {
  __typename?: 'ServiceSchemaDiff';
  after?: Maybe<Scalars['String']['output']>;
  before?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
};

export type SetTargetValidationInput = {
  enabled: Scalars['Boolean']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type SingleSchema = {
  __typename?: 'SingleSchema';
  author: Scalars['String']['output'];
  commit: Scalars['ID']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  metadata?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
};

export type SlackChannelInput = {
  channel: Scalars['String']['input'];
};

/** A successful schema check. */
export type SuccessfulSchemaCheck = SchemaCheck & {
  __typename?: 'SuccessfulSchemaCheck';
  compositeSchemaSDL?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Meta information about the schema check. */
  meta?: Maybe<SchemaCheckMeta>;
  safeSchemaChanges?: Maybe<SchemaChangeConnection>;
  schemaPolicyWarnings?: Maybe<SchemaPolicyWarningConnection>;
  /** The SDL of the schema that was checked. */
  schemaSDL: Scalars['String']['output'];
  /**
   * The schema version against this check was performed.
   * Is null if there is no schema version published yet.
   */
  schemaVersion?: Maybe<SchemaVersion>;
  /** The name of the service that owns the schema. Is null for non composite project types. */
  serviceName?: Maybe<Scalars['String']['output']>;
  supergraphSDL?: Maybe<Scalars['String']['output']>;
  /** The URL of the schema check on the Hive Web App. */
  webUrl?: Maybe<Scalars['String']['output']>;
};

export type SupergraphMetadata = {
  __typename?: 'SupergraphMetadata';
  /**
   * List of service names that own the field/type.
   * Resolves to null if the entity (field, type, scalar) does not belong to any service.
   */
  ownedByServiceNames?: Maybe<Array<Scalars['String']['output']>>;
};

export type Target = {
  __typename?: 'Target';
  baseSchema?: Maybe<Scalars['String']['output']>;
  /** A paginated connection of CDN tokens for accessing this target's artifacts. */
  cdnAccessTokens: TargetCdnAccessTokenConnection;
  /** The URL for accessing this target's artifacts via the CDN. */
  cdnUrl: Scalars['String']['output'];
  cleanId: Scalars['ID']['output'];
  documentCollection?: Maybe<DocumentCollection>;
  documentCollectionOperation?: Maybe<DocumentCollectionOperation>;
  documentCollections: DocumentCollectionConnection;
  hasSchema: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  latestSchemaVersion?: Maybe<SchemaVersion>;
  name: Scalars['String']['output'];
  project: Project;
  requestsOverTime: Array<RequestsOverTime>;
  /** Get a schema check for the target by ID. */
  schemaCheck?: Maybe<SchemaCheck>;
  /** Get a list of paginated schema checks for a target. */
  schemaChecks: SchemaCheckConnection;
  /** A merged representation of the schema policy, as inherited from the organization and project. */
  schemaPolicy?: Maybe<TargetSchemaPolicy>;
  schemaVersionsCount: Scalars['Int']['output'];
  tokens: TokenConnection;
  validationSettings: TargetValidationSettings;
};


export type TargetCdnAccessTokensArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type TargetDocumentCollectionArgs = {
  id: Scalars['ID']['input'];
};


export type TargetDocumentCollectionOperationArgs = {
  id: Scalars['ID']['input'];
};


export type TargetDocumentCollectionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type TargetRequestsOverTimeArgs = {
  period: DateRangeInput;
  resolution: Scalars['Int']['input'];
};


export type TargetSchemaCheckArgs = {
  id: Scalars['ID']['input'];
};


export type TargetSchemaChecksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type TargetSchemaVersionsCountArgs = {
  period?: InputMaybe<DateRangeInput>;
};

export enum TargetAccessScope {
  Delete = 'DELETE',
  Read = 'READ',
  RegistryRead = 'REGISTRY_READ',
  RegistryWrite = 'REGISTRY_WRITE',
  Settings = 'SETTINGS',
  TokensRead = 'TOKENS_READ',
  TokensWrite = 'TOKENS_WRITE'
}

export type TargetActivitiesSelector = {
  limit: Scalars['Int']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type TargetCdnAccessTokenConnection = {
  __typename?: 'TargetCdnAccessTokenConnection';
  edges: Array<TargetCdnAccessTokenEdge>;
  pageInfo: PageInfo;
};

export type TargetCdnAccessTokenEdge = {
  __typename?: 'TargetCdnAccessTokenEdge';
  cursor: Scalars['String']['output'];
  node: CdnAccessToken;
};

export type TargetConnection = {
  __typename?: 'TargetConnection';
  nodes: Array<Target>;
  total: Scalars['Int']['output'];
};

export type TargetCreatedActivity = Activity & {
  __typename?: 'TargetCreatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  project: Project;
  target: Target;
  type: Scalars['String']['output'];
  user: User;
};

export type TargetDeletedActivity = Activity & {
  __typename?: 'TargetDeletedActivity';
  cleanId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  organization: Organization;
  project: Project;
  type: Scalars['String']['output'];
  user: User;
};

export type TargetIdUpdatedActivity = Activity & {
  __typename?: 'TargetIdUpdatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  project: Project;
  target: Target;
  type: Scalars['String']['output'];
  user: User;
  value: Scalars['String']['output'];
};

export type TargetNameUpdatedActivity = Activity & {
  __typename?: 'TargetNameUpdatedActivity';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  organization: Organization;
  project: Project;
  target: Target;
  type: Scalars['String']['output'];
  user: User;
  value: Scalars['String']['output'];
};

export type TargetSchemaPolicy = {
  __typename?: 'TargetSchemaPolicy';
  mergedRules: Array<SchemaPolicyRuleInstance>;
  organizationPolicy?: Maybe<SchemaPolicy>;
  projectPolicy?: Maybe<SchemaPolicy>;
};

export type TargetSelector = {
  __typename?: 'TargetSelector';
  organization: Scalars['ID']['output'];
  project: Scalars['ID']['output'];
  target: Scalars['ID']['output'];
};

export type TargetSelectorInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type TargetValidationSettings = {
  __typename?: 'TargetValidationSettings';
  enabled: Scalars['Boolean']['output'];
  excludedClients: Array<Scalars['String']['output']>;
  percentage: Scalars['Float']['output'];
  period: Scalars['Int']['output'];
  targets: Array<Target>;
};

export type TestExternalSchemaCompositionError = Error & {
  __typename?: 'TestExternalSchemaCompositionError';
  message: Scalars['String']['output'];
};

export type TestExternalSchemaCompositionInput = {
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

/** @oneOf */
export type TestExternalSchemaCompositionResult = {
  __typename?: 'TestExternalSchemaCompositionResult';
  error?: Maybe<TestExternalSchemaCompositionError>;
  ok?: Maybe<Project>;
};

export type Token = {
  __typename?: 'Token';
  alias: Scalars['String']['output'];
  date: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
};

export type TokenConnection = {
  __typename?: 'TokenConnection';
  nodes: Array<Token>;
  total: Scalars['Int']['output'];
};

export type TokenInfo = {
  __typename?: 'TokenInfo';
  hasOrganizationScope: Scalars['Boolean']['output'];
  hasProjectScope: Scalars['Boolean']['output'];
  hasTargetScope: Scalars['Boolean']['output'];
  organization: Organization;
  project: Project;
  target: Target;
  token: Token;
};


export type TokenInfoHasOrganizationScopeArgs = {
  scope: OrganizationAccessScope;
};


export type TokenInfoHasProjectScopeArgs = {
  scope: ProjectAccessScope;
};


export type TokenInfoHasTargetScopeArgs = {
  scope: TargetAccessScope;
};

export type TokenInfoPayload = TokenInfo | TokenNotFoundError;

export type TokenNotFoundError = {
  __typename?: 'TokenNotFoundError';
  message: Scalars['String']['output'];
};

export type UpdateBaseSchemaError = Error & {
  __typename?: 'UpdateBaseSchemaError';
  message: Scalars['String']['output'];
};

export type UpdateBaseSchemaInput = {
  newBase?: InputMaybe<Scalars['String']['input']>;
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type UpdateBaseSchemaOk = {
  __typename?: 'UpdateBaseSchemaOk';
  updatedTarget: Target;
};

export type UpdateBaseSchemaResult = {
  __typename?: 'UpdateBaseSchemaResult';
  error?: Maybe<UpdateBaseSchemaError>;
  ok?: Maybe<UpdateBaseSchemaOk>;
};

export type UpdateDocumentCollectionInput = {
  collectionId: Scalars['ID']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type UpdateDocumentCollectionOperationInput = {
  collectionId: Scalars['ID']['input'];
  headers?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  operationId: Scalars['ID']['input'];
  query: Scalars['String']['input'];
  variables?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateMeError = Error & {
  __typename?: 'UpdateMeError';
  /** The detailed validation error messages for the input fields. */
  inputErrors: UpdateMeInputErrors;
  message: Scalars['String']['output'];
};

export type UpdateMeInput = {
  displayName: Scalars['String']['input'];
  fullName: Scalars['String']['input'];
};

export type UpdateMeInputErrors = {
  __typename?: 'UpdateMeInputErrors';
  displayName?: Maybe<Scalars['String']['output']>;
  fullName?: Maybe<Scalars['String']['output']>;
};

export type UpdateMeOk = {
  __typename?: 'UpdateMeOk';
  updatedUser: User;
};

/** @oneOf */
export type UpdateMeResult = {
  __typename?: 'UpdateMeResult';
  error?: Maybe<UpdateMeError>;
  ok?: Maybe<UpdateMeOk>;
};

export type UpdateOidcIntegrationError = Error & {
  __typename?: 'UpdateOIDCIntegrationError';
  details: UpdateOidcIntegrationErrorDetails;
  message: Scalars['String']['output'];
};

export type UpdateOidcIntegrationErrorDetails = {
  __typename?: 'UpdateOIDCIntegrationErrorDetails';
  authorizationEndpoint?: Maybe<Scalars['String']['output']>;
  clientId?: Maybe<Scalars['String']['output']>;
  clientSecret?: Maybe<Scalars['String']['output']>;
  tokenEndpoint?: Maybe<Scalars['String']['output']>;
  userinfoEndpoint?: Maybe<Scalars['String']['output']>;
};

export type UpdateOidcIntegrationInput = {
  authorizationEndpoint?: InputMaybe<Scalars['String']['input']>;
  clientId?: InputMaybe<Scalars['ID']['input']>;
  clientSecret?: InputMaybe<Scalars['String']['input']>;
  oidcIntegrationId: Scalars['ID']['input'];
  tokenEndpoint?: InputMaybe<Scalars['String']['input']>;
  userinfoEndpoint?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOidcIntegrationOk = {
  __typename?: 'UpdateOIDCIntegrationOk';
  updatedOIDCIntegration: OidcIntegration;
};

export type UpdateOidcIntegrationResult = {
  __typename?: 'UpdateOIDCIntegrationResult';
  error?: Maybe<UpdateOidcIntegrationError>;
  ok?: Maybe<UpdateOidcIntegrationOk>;
};

export type UpdateOrganizationNameError = Error & {
  __typename?: 'UpdateOrganizationNameError';
  message: Scalars['String']['output'];
};

export type UpdateOrganizationNameInput = {
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
};

export type UpdateOrganizationNameOk = {
  __typename?: 'UpdateOrganizationNameOk';
  updatedOrganizationPayload: OrganizationPayload;
};

export type UpdateOrganizationNameResult = {
  __typename?: 'UpdateOrganizationNameResult';
  error?: Maybe<UpdateOrganizationNameError>;
  ok?: Maybe<UpdateOrganizationNameOk>;
};

export type UpdateProjectGitRepositoryError = Error & {
  __typename?: 'UpdateProjectGitRepositoryError';
  message: Scalars['String']['output'];
};

export type UpdateProjectGitRepositoryInput = {
  gitRepository?: InputMaybe<Scalars['String']['input']>;
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type UpdateProjectGitRepositoryOk = {
  __typename?: 'UpdateProjectGitRepositoryOk';
  selector: ProjectSelector;
  updatedProject: Project;
};

export type UpdateProjectGitRepositoryResult = {
  __typename?: 'UpdateProjectGitRepositoryResult';
  error?: Maybe<UpdateProjectGitRepositoryError>;
  ok?: Maybe<UpdateProjectGitRepositoryOk>;
};

export type UpdateProjectNameError = Error & {
  __typename?: 'UpdateProjectNameError';
  message: Scalars['String']['output'];
};

export type UpdateProjectNameInput = {
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

export type UpdateProjectNameOk = {
  __typename?: 'UpdateProjectNameOk';
  selector: ProjectSelector;
  updatedProject: Project;
};

export type UpdateProjectNameResult = {
  __typename?: 'UpdateProjectNameResult';
  error?: Maybe<UpdateProjectNameError>;
  ok?: Maybe<UpdateProjectNameOk>;
};

export type UpdateProjectPayload = {
  __typename?: 'UpdateProjectPayload';
  selector: ProjectSelector;
  updatedProject: Project;
};

export type UpdateProjectRegistryModelError = Error & {
  __typename?: 'UpdateProjectRegistryModelError';
  message: Scalars['String']['output'];
};

export type UpdateProjectRegistryModelInput = {
  model: RegistryModel;
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
};

/** @oneOf */
export type UpdateProjectRegistryModelResult = {
  __typename?: 'UpdateProjectRegistryModelResult';
  error?: Maybe<UpdateProjectRegistryModelError>;
  ok?: Maybe<Project>;
};

export type UpdateSchemaPolicyResult = {
  __typename?: 'UpdateSchemaPolicyResult';
  error?: Maybe<Error>;
  ok?: Maybe<UpdateSchemaPolicyResultOk>;
};

export type UpdateSchemaPolicyResultError = Error & {
  __typename?: 'UpdateSchemaPolicyResultError';
  code?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
};

export type UpdateSchemaPolicyResultOk = {
  __typename?: 'UpdateSchemaPolicyResultOk';
  organization?: Maybe<Organization>;
  project?: Maybe<Project>;
  updatedPolicy: SchemaPolicy;
};

export type UpdateTargetNameError = Error & {
  __typename?: 'UpdateTargetNameError';
  inputErrors: UpdateTargetNameInputErrors;
  message: Scalars['String']['output'];
};

export type UpdateTargetNameInput = {
  name: Scalars['String']['input'];
  organization: Scalars['ID']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
};

export type UpdateTargetNameInputErrors = {
  __typename?: 'UpdateTargetNameInputErrors';
  name?: Maybe<Scalars['String']['output']>;
};

export type UpdateTargetNameOk = {
  __typename?: 'UpdateTargetNameOk';
  selector: TargetSelector;
  updatedTarget: Target;
};

export type UpdateTargetNameResult = {
  __typename?: 'UpdateTargetNameResult';
  error?: Maybe<UpdateTargetNameError>;
  ok?: Maybe<UpdateTargetNameOk>;
};

export type UpdateTargetValidationSettingsError = Error & {
  __typename?: 'UpdateTargetValidationSettingsError';
  inputErrors: UpdateTargetValidationSettingsInputErrors;
  message: Scalars['String']['output'];
};

export type UpdateTargetValidationSettingsInput = {
  excludedClients?: InputMaybe<Array<Scalars['String']['input']>>;
  organization: Scalars['ID']['input'];
  percentage: Scalars['Float']['input'];
  period: Scalars['Int']['input'];
  project: Scalars['ID']['input'];
  target: Scalars['ID']['input'];
  targets: Array<Scalars['ID']['input']>;
};

export type UpdateTargetValidationSettingsInputErrors = {
  __typename?: 'UpdateTargetValidationSettingsInputErrors';
  percentage?: Maybe<Scalars['String']['output']>;
  period?: Maybe<Scalars['String']['output']>;
};

export type UpdateTargetValidationSettingsOk = {
  __typename?: 'UpdateTargetValidationSettingsOk';
  target: Target;
};

export type UpdateTargetValidationSettingsResult = {
  __typename?: 'UpdateTargetValidationSettingsResult';
  error?: Maybe<UpdateTargetValidationSettingsError>;
  ok?: Maybe<UpdateTargetValidationSettingsOk>;
};

export type UpgradeToProInput = {
  couponCode?: InputMaybe<Scalars['String']['input']>;
  monthlyLimits: RateLimitInput;
  organization: OrganizationSelectorInput;
  paymentMethodId?: InputMaybe<Scalars['String']['input']>;
};

export type UsageEstimation = {
  __typename?: 'UsageEstimation';
  operations: Scalars['SafeInt']['output'];
};

export type UsageEstimationScope = {
  __typename?: 'UsageEstimationScope';
  org: UsageEstimation;
  target: UsageEstimation;
};


export type UsageEstimationScopeOrgArgs = {
  selector: OrganizationSelectorInput;
};


export type UsageEstimationScopeTargetArgs = {
  selector: TargetSelectorInput;
};

export enum UsageRateLimitType {
  MonthlyLimited = 'MONTHLY_LIMITED',
  MonthlyQuota = 'MONTHLY_QUOTA',
  Unlimited = 'UNLIMITED'
}

export type User = {
  __typename?: 'User';
  canSwitchOrganization: Scalars['Boolean']['output'];
  displayName: Scalars['String']['output'];
  email: Scalars['String']['output'];
  fullName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isAdmin: Scalars['Boolean']['output'];
  provider: AuthProvider;
};

export type UserConnection = {
  __typename?: 'UserConnection';
  nodes: Array<User>;
  total: Scalars['Int']['output'];
};

export type WebhookChannelInput = {
  endpoint: Scalars['String']['input'];
};

export type FetchLatestVersionQueryVariables = Exact<{ [key: string]: never; }>;


export type FetchLatestVersionQuery = { __typename?: 'Query', latestValidVersion?: { __typename?: 'SchemaVersion', sdl?: string | null } | null };

export type SchemaCheckMutationVariables = Exact<{
  input: SchemaCheckInput;
  usesGitHubApp: Scalars['Boolean']['input'];
}>;


export type SchemaCheckMutation = { __typename?: 'Mutation', schemaCheck: { __typename: 'GitHubSchemaCheckError', message: string } | { __typename: 'GitHubSchemaCheckSuccess', message: string } | { __typename: 'SchemaCheckError', valid: boolean, changes?: { __typename?: 'SchemaChangeConnection', total: number, nodes: Array<{ __typename?: 'SchemaChange', message: string, criticality: CriticalityLevel }> } | null, warnings?: { __typename?: 'SchemaWarningConnection', total: number, nodes: Array<{ __typename?: 'SchemaCheckWarning', message: string, source?: string | null, line?: number | null, column?: number | null }> } | null, errors: { __typename?: 'SchemaErrorConnection', total: number, nodes: Array<{ __typename?: 'SchemaError', message: string }> }, schemaCheck?: { __typename?: 'FailedSchemaCheck', webUrl?: string | null } | { __typename?: 'SuccessfulSchemaCheck', webUrl?: string | null } | null } | { __typename: 'SchemaCheckSuccess', valid: boolean, initial: boolean, warnings?: { __typename?: 'SchemaWarningConnection', total: number, nodes: Array<{ __typename?: 'SchemaCheckWarning', message: string, source?: string | null, line?: number | null, column?: number | null }> } | null, changes?: { __typename?: 'SchemaChangeConnection', total: number, nodes: Array<{ __typename?: 'SchemaChange', message: string, criticality: CriticalityLevel }> } | null, schemaCheck?: { __typename?: 'FailedSchemaCheck', webUrl?: string | null } | { __typename?: 'SuccessfulSchemaCheck', webUrl?: string | null } | null } };

export type SchemaDeleteMutationVariables = Exact<{
  input: SchemaDeleteInput;
}>;


export type SchemaDeleteMutation = { __typename?: 'Mutation', schemaDelete: { __typename: 'SchemaDeleteError', valid: boolean, errors: { __typename?: 'SchemaErrorConnection', total: number, nodes: Array<{ __typename?: 'SchemaError', message: string }> } } | { __typename: 'SchemaDeleteSuccess', valid: boolean, changes?: { __typename?: 'SchemaChangeConnection', total: number, nodes: Array<{ __typename?: 'SchemaChange', criticality: CriticalityLevel, message: string }> } | null, errors: { __typename?: 'SchemaErrorConnection', total: number, nodes: Array<{ __typename?: 'SchemaError', message: string }> } } };

export type SchemaPublishMutationVariables = Exact<{
  input: SchemaPublishInput;
  usesGitHubApp: Scalars['Boolean']['input'];
}>;


export type SchemaPublishMutation = { __typename?: 'Mutation', schemaPublish: { __typename: 'GitHubSchemaPublishError', message: string } | { __typename: 'GitHubSchemaPublishSuccess', message: string } | { __typename: 'SchemaPublishError', valid: boolean, linkToWebsite?: string | null, changes?: { __typename?: 'SchemaChangeConnection', total: number, nodes: Array<{ __typename?: 'SchemaChange', message: string, criticality: CriticalityLevel }> } | null, errors: { __typename?: 'SchemaErrorConnection', total: number, nodes: Array<{ __typename?: 'SchemaError', message: string }> } } | { __typename: 'SchemaPublishMissingServiceError', missingServiceError: string } | { __typename: 'SchemaPublishMissingUrlError', missingUrlError: string } | { __typename: 'SchemaPublishSuccess', initial: boolean, valid: boolean, linkToWebsite?: string | null, successMessage?: string | null, changes?: { __typename?: 'SchemaChangeConnection', total: number, nodes: Array<{ __typename?: 'SchemaChange', message: string, criticality: CriticalityLevel }> } | null } };

export type MyTokenInfoQueryVariables = Exact<{ [key: string]: never; }>;


export type MyTokenInfoQuery = { __typename?: 'Query', tokenInfo: { __typename: 'TokenInfo', canPublishSchema: boolean, canCheckSchema: boolean, canPublishOperations: boolean, token: { __typename?: 'Token', name: string }, organization: { __typename?: 'Organization', name: string, cleanId: string }, project: { __typename?: 'Project', name: string, type: ProjectType, cleanId: string }, target: { __typename?: 'Target', name: string, cleanId: string } } | { __typename: 'TokenNotFoundError', message: string } };


export const FetchLatestVersionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"fetchLatestVersion"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latestValidVersion"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sdl"}}]}}]}}]} as unknown as DocumentNode<FetchLatestVersionQuery, FetchLatestVersionQueryVariables>;
export const SchemaCheckDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"schemaCheck"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaCheckInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schemaCheck"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaCheckSuccess"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"skip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"initial"}},{"kind":"Field","name":{"kind":"Name","value":"warnings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"column"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"changes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"criticality"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"schemaCheck"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"webUrl"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaCheckError"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"skip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"changes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"criticality"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"warnings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"line"}},{"kind":"Field","name":{"kind":"Name","value":"column"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"schemaCheck"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"webUrl"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GitHubSchemaCheckSuccess"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GitHubSchemaCheckError"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]} as unknown as DocumentNode<SchemaCheckMutation, SchemaCheckMutationVariables>;
export const SchemaDeleteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"schemaDelete"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaDeleteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schemaDelete"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaDeleteSuccess"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"changes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"criticality"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaDeleteError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SchemaDeleteMutation, SchemaDeleteMutationVariables>;
export const SchemaPublishDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"schemaPublish"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaPublishInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"schemaPublish"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaPublishSuccess"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"skip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"initial"}},{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","alias":{"kind":"Name","value":"successMessage"},"name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"linkToWebsite"}},{"kind":"Field","name":{"kind":"Name","value":"changes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"criticality"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaPublishError"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"skip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"valid"}},{"kind":"Field","name":{"kind":"Name","value":"linkToWebsite"}},{"kind":"Field","name":{"kind":"Name","value":"changes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"criticality"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}},{"kind":"Field","name":{"kind":"Name","value":"errors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaPublishMissingServiceError"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"skip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"missingServiceError"},"name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchemaPublishMissingUrlError"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"skip"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"missingUrlError"},"name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GitHubSchemaPublishSuccess"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"GitHubSchemaPublishError"}},"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usesGitHubApp"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]} as unknown as DocumentNode<SchemaPublishMutation, SchemaPublishMutationVariables>;
export const MyTokenInfoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"myTokenInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tokenInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TokenInfo"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"organization"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"cleanId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"cleanId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"target"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"cleanId"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"canPublishSchema"},"name":{"kind":"Name","value":"hasTargetScope"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scope"},"value":{"kind":"EnumValue","value":"REGISTRY_WRITE"}}]},{"kind":"Field","alias":{"kind":"Name","value":"canCheckSchema"},"name":{"kind":"Name","value":"hasTargetScope"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scope"},"value":{"kind":"EnumValue","value":"REGISTRY_READ"}}]},{"kind":"Field","alias":{"kind":"Name","value":"canPublishOperations"},"name":{"kind":"Name","value":"hasProjectScope"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"scope"},"value":{"kind":"EnumValue","value":"OPERATIONS_STORE_WRITE"}}]}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TokenNotFoundError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]}}]} as unknown as DocumentNode<MyTokenInfoQuery, MyTokenInfoQueryVariables>;