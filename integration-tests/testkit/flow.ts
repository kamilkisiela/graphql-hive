import { gql } from '@app/gql';
import { fetch } from '@whatwg-node/fetch';
import type {
  AnswerOrganizationTransferRequestInput,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTargetInput,
  CreateTokenInput,
  DeleteTokensInput,
  EnableExternalSchemaCompositionInput,
  InviteToOrganizationByEmailInput,
  OperationsStatsSelectorInput,
  OrganizationMemberAccessInput,
  OrganizationSelectorInput,
  OrganizationTransferRequestSelector,
  PublishPersistedOperationInput,
  RateLimitInput,
  RequestOrganizationTransferInput,
  SchemaCheckInput,
  SchemaPublishInput,
  SchemaVersionsInput,
  SchemaVersionUpdateInput,
  SetTargetValidationInput,
  TargetSelectorInput,
  UpdateBaseSchemaInput,
  UpdateOrganizationNameInput,
  UpdateProjectNameInput,
  UpdateProjectRegistryModelInput,
  UpdateTargetNameInput,
  UpdateTargetValidationSettingsInput,
} from './gql/graphql';
import { execute } from './graphql';

export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createOrganization(input: CreateOrganizationInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation createOrganization($input: CreateOrganizationInput!) {
        createOrganization(input: $input) {
          ok {
            createdOrganizationPayload {
              organization {
                id
                name
                cleanId
                owner {
                  id
                  organizationAccessScopes
                  projectAccessScopes
                  targetAccessScopes
                }
              }
            }
          }
          error {
            message
            inputErrors {
              name
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function getOrganization(organizationId: string, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query getOrganization($organizationId: ID!) {
        organization(selector: { organization: $organizationId }) {
          organization {
            id
            cleanId
            name
            type
            getStarted {
              creatingProject
              publishingSchema
              checkingSchema
              invitingMembers
              reportingOperations
              enablingUsageBasedBreakingChanges
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      organizationId,
    },
  });
}

export function inviteToOrganization(input: InviteToOrganizationByEmailInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation inviteToOrganization($input: InviteToOrganizationByEmailInput!) {
        inviteToOrganizationByEmail(input: $input) {
          ok {
            id
            createdAt
            expiresAt
            email
            code
          }
          error {
            message
          }
        }
      }
    `),
    variables: {
      input,
    },
    authToken,
  });
}

export function renameOrganization(input: UpdateOrganizationNameInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateOrganizationName($input: UpdateOrganizationNameInput!) {
        updateOrganizationName(input: $input) {
          ok {
            updatedOrganizationPayload {
              selector {
                organization
              }
              organization {
                id
                name
                cleanId
              }
            }
          }
          error {
            message
          }
        }
      }
    `),
    variables: {
      input,
    },
    authToken,
  });
}

export function joinOrganization(code: string, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation joinOrganization($code: String!) {
        joinOrganization(code: $code) {
          __typename
          ... on OrganizationPayload {
            organization {
              id
              name
              cleanId
              me {
                id
                organizationAccessScopes
                projectAccessScopes
                targetAccessScopes
              }
            }
          }
          ... on OrganizationInvitationError {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      code,
    },
  });
}

export function getOrganizationMembers(selector: OrganizationSelectorInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query getOrganizationMembers($selector: OrganizationSelectorInput!) {
        organization(selector: $selector) {
          organization {
            members {
              nodes {
                id
                user {
                  email
                }
                organizationAccessScopes
                projectAccessScopes
                targetAccessScopes
              }
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      selector,
    },
  });
}

export function getOrganizationTransferRequest(
  selector: OrganizationTransferRequestSelector,
  authToken: string,
) {
  return execute({
    document: gql(/* GraphQL */ `
      query getOrganizationTransferRequest($selector: OrganizationTransferRequestSelector!) {
        organizationTransferRequest(selector: $selector) {
          organization {
            id
          }
        }
      }
    `),
    authToken,
    variables: {
      selector,
    },
  });
}

export function requestOrganizationTransfer(
  input: RequestOrganizationTransferInput,
  authToken: string,
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation requestOrganizationTransfer($input: RequestOrganizationTransferInput!) {
        requestOrganizationTransfer(input: $input) {
          ok {
            email
            code
          }
          error {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function answerOrganizationTransferRequest(
  input: AnswerOrganizationTransferRequestInput,
  authToken: string,
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation answerOrganizationTransferRequest($input: AnswerOrganizationTransferRequestInput!) {
        answerOrganizationTransferRequest(input: $input) {
          ok {
            accepted
          }
          error {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function createProject(input: CreateProjectInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation createProject($input: CreateProjectInput!) {
        createProject(input: $input) {
          ok {
            createdProject {
              id
              cleanId
            }
            createdTargets {
              id
              cleanId
              name
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function renameProject(input: UpdateProjectNameInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateProjectName($input: UpdateProjectNameInput!) {
        updateProjectName(input: $input) {
          ok {
            selector {
              organization
              project
            }
            updatedProject {
              id
              cleanId
              name
            }
          }
          error {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function updateRegistryModel(input: UpdateProjectRegistryModelInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateRegistryModel($input: UpdateProjectRegistryModelInput!) {
        updateProjectRegistryModel(input: $input) {
          ok {
            id
            cleanId
            name
          }
          error {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function createTarget(input: CreateTargetInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation createTarget($input: CreateTargetInput!) {
        createTarget(input: $input) {
          ok {
            createdTarget {
              id
              cleanId
            }
          }
          error {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function renameTarget(input: UpdateTargetNameInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateTargetName($input: UpdateTargetNameInput!) {
        updateTargetName(input: $input) {
          ok {
            selector {
              organization
              project
              target
            }
            updatedTarget {
              id
              cleanId
              name
            }
          }
          error {
            message
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function createToken(input: CreateTokenInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation createToken($input: CreateTokenInput!) {
        createToken(input: $input) {
          ok {
            secret
            createdToken {
              id
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function deleteTokens(input: DeleteTokensInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation deleteTokens($input: DeleteTokensInput!) {
        deleteTokens(input: $input) {
          deletedTokens
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function readTokenInfo(token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query readTokenInfo {
        tokenInfo {
          __typename
          ... on TokenInfo {
            hasOrganizationRead: hasOrganizationScope(scope: READ)
            hasOrganizationDelete: hasOrganizationScope(scope: DELETE)
            hasOrganizationSettings: hasOrganizationScope(scope: SETTINGS)
            hasOrganizationIntegrations: hasOrganizationScope(scope: INTEGRATIONS)
            hasOrganizationMembers: hasOrganizationScope(scope: MEMBERS)
            hasProjectRead: hasProjectScope(scope: READ)
            hasProjectDelete: hasProjectScope(scope: DELETE)
            hasProjectSettings: hasProjectScope(scope: SETTINGS)
            hasProjectAlerts: hasProjectScope(scope: ALERTS)
            hasProjectOperationsStoreRead: hasProjectScope(scope: OPERATIONS_STORE_READ)
            hasProjectOperationsStoreWrite: hasProjectScope(scope: OPERATIONS_STORE_WRITE)
            hasTargetRead: hasTargetScope(scope: READ)
            hasTargetDelete: hasTargetScope(scope: DELETE)
            hasTargetSettings: hasTargetScope(scope: SETTINGS)
            hasTargetRegistryRead: hasTargetScope(scope: REGISTRY_READ)
            hasTargetRegistryWrite: hasTargetScope(scope: REGISTRY_WRITE)
            hasTargetTokensRead: hasTargetScope(scope: TOKENS_READ)
            hasTargetTokensWrite: hasTargetScope(scope: TOKENS_WRITE)
          }
          ... on TokenNotFoundError {
            message
          }
        }
      }
    `),
    token,
  });
}

export function updateMemberAccess(input: OrganizationMemberAccessInput, authToken: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateOrganizationMemberAccess($input: OrganizationMemberAccessInput!) {
        updateOrganizationMemberAccess(input: $input) {
          organization {
            cleanId
            members {
              nodes {
                id
                organizationAccessScopes
                projectAccessScopes
                targetAccessScopes
              }
            }
            me {
              id
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      input,
    },
  });
}

export function publishSchema(
  input: SchemaPublishInput,
  token: string,
  authHeader?: 'x-api-token' | 'authorization',
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation schemaPublish($input: SchemaPublishInput!) {
        schemaPublish(input: $input) {
          __typename
          ... on SchemaPublishSuccess {
            initial
            valid
            message
            linkToWebsite
            changes {
              nodes {
                message
                criticality
              }
              total
            }
          }
          ... on SchemaPublishError {
            valid
            linkToWebsite
            changes {
              nodes {
                message
                criticality
              }
              total
            }
            errors {
              nodes {
                message
              }
              total
            }
          }
        }
      }
    `),
    token,
    variables: {
      input,
    },
    legacyAuthorizationMode: authHeader === 'x-api-token',
  });
}

export function checkSchema(input: SchemaCheckInput, token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation schemaCheck($input: SchemaCheckInput!) {
        schemaCheck(input: $input) {
          ... on SchemaCheckSuccess {
            __typename
            valid
            changes {
              nodes {
                message
                criticality
              }
              total
            }
          }
          ... on SchemaCheckError {
            __typename
            valid
            changes {
              nodes {
                message
                criticality
              }
              total
            }
            errors {
              nodes {
                message
              }
              total
            }
          }
        }
      }
    `),
    token,
    variables: {
      input,
    },
  });
}

export function setTargetValidation(
  input: SetTargetValidationInput,
  access:
    | {
        token: string;
      }
    | {
        authToken: string;
      },
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation setTargetValidation($input: SetTargetValidationInput!) {
        setTargetValidation(input: $input) {
          enabled
          period
          percentage
          excludedClients
        }
      }
    `),
    ...access,
    variables: {
      input,
    },
  });
}

export function updateTargetValidationSettings(
  input: UpdateTargetValidationSettingsInput,
  access:
    | {
        token: string;
      }
    | {
        authToken: string;
      },
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateTargetValidationSettings($input: UpdateTargetValidationSettingsInput!) {
        updateTargetValidationSettings(input: $input) {
          ok {
            updatedTargetValidationSettings {
              id
              enabled
              period
              percentage
              targets {
                id
              }
              excludedClients
            }
          }
          error {
            message
            inputErrors {
              percentage
              period
            }
          }
        }
      }
    `),
    ...access,
    variables: {
      input,
    },
  });
}

export function updateBaseSchema(input: UpdateBaseSchemaInput, token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateBaseSchema($input: UpdateBaseSchemaInput!) {
        updateBaseSchema(input: $input) {
          __typename
        }
      }
    `),
    token,
    variables: {
      input,
    },
  });
}

export function readOperationsStats(input: OperationsStatsSelectorInput, token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query readOperationsStats($input: OperationsStatsSelectorInput!) {
        operationsStats(selector: $input) {
          totalOperations
          operations {
            nodes {
              id
              document
              operationHash
              kind
              name
              count
              percentage
              duration {
                p75
                p90
                p95
                p99
              }
            }
          }
        }
      }
    `),
    token,
    variables: {
      input,
    },
  });
}

export function fetchLatestSchema(token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query latestVersion {
        latestVersion {
          baseSchema
          commit {
            source
            commit
          }
          schemas {
            nodes {
              source
              commit
              url
            }
            total
          }
        }
      }
    `),
    token,
  });
}

export function fetchLatestValidSchema(token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query latestValidVersion {
        latestValidVersion {
          id
          baseSchema
          commit {
            source
            commit
          }
          schemas {
            nodes {
              source
              commit
            }
            total
          }
        }
      }
    `),
    token,
  });
}

export function fetchVersions(selector: SchemaVersionsInput, limit: number, token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      query schemaVersions($limit: Int!, $selector: SchemaVersionsInput!) {
        schemaVersions(selector: $selector, limit: $limit) {
          nodes {
            id
            valid
            date
            commit {
              source
              commit
            }
            baseSchema
            schemas {
              nodes {
                source
                commit
              }
            }
          }
        }
      }
    `),
    token,
    variables: {
      selector,
      limit,
    },
  });
}

export function publishPersistedOperations(input: PublishPersistedOperationInput[], token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation publishPersistedOperations($input: [PublishPersistedOperationInput!]!) {
        publishPersistedOperations(input: $input) {
          summary {
            total
            unchanged
          }
          operations {
            id
            operationHash
            content
            name
            kind
          }
        }
      }
    `),
    token,
    variables: {
      input,
    },
  });
}

export function updateSchemaVersionStatus(input: SchemaVersionUpdateInput, token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateSchemaVersionStatus($input: SchemaVersionUpdateInput!) {
        updateSchemaVersionStatus(input: $input) {
          id
          date
          valid
          commit {
            id
            commit
          }
        }
      }
    `),
    token,
    variables: {
      input,
    },
  });
}

export function createCdnAccess(selector: TargetSelectorInput, token: string) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation createCdnToken($selector: TargetSelectorInput!) {
        createCdnToken(selector: $selector) {
          url
          token
        }
      }
    `),
    token,
    variables: {
      selector,
    },
  });
}

export async function fetchSchemaFromCDN(selector: TargetSelectorInput, token: string) {
  const cdnAccessResult = await createCdnAccess(selector, token).then(r =>
    r.expectNoGraphQLErrors(),
  );

  const cdn = cdnAccessResult.createCdnToken;

  const res = await fetch(cdn.url + '/sdl', {
    headers: {
      'X-Hive-CDN-Key': cdn.token,
    },
  });

  return {
    body: await res.text(),
    status: res.status,
  };
}

export async function fetchSupergraphFromCDN(selector: TargetSelectorInput, token: string) {
  const cdnAccessResult = await createCdnAccess(selector, token).then(r =>
    r.expectNoGraphQLErrors(),
  );

  const cdn = cdnAccessResult.createCdnToken;

  const res = await fetch(cdn.url + '/supergraph', {
    headers: {
      'X-Hive-CDN-Key': cdn.token,
    },
  });

  const textBody = await res.text();

  return {
    body: textBody,
    status: res.status,
  };
}

export async function fetchMetadataFromCDN(selector: TargetSelectorInput, token: string) {
  const cdnAccessResult = await createCdnAccess(selector, token).then(r =>
    r.expectNoGraphQLErrors(),
  );

  const cdn = cdnAccessResult.createCdnToken;

  const res = await fetch(cdn.url + '/metadata', {
    headers: {
      Accept: 'application/json',
      'X-Hive-CDN-Key': cdn.token,
    },
  });

  const jsonBody = await res.json();

  return {
    body: jsonBody,
    status: res.status,
  };
}

export async function updateOrgRateLimit(
  selector: OrganizationSelectorInput,
  monthlyLimits: RateLimitInput,
  authToken: string,
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation updateOrgRateLimit(
        $selector: OrganizationSelectorInput!
        $monthlyLimits: RateLimitInput!
      ) {
        updateOrgRateLimit(selector: $selector, monthlyLimits: $monthlyLimits) {
          id
        }
      }
    `),
    variables: {
      selector,
      monthlyLimits,
    },
    authToken,
  });
}

export async function enableExternalSchemaComposition(
  input: EnableExternalSchemaCompositionInput,
  token: string,
) {
  return execute({
    document: gql(/* GraphQL */ `
      mutation enableExternalSchemaComposition($input: EnableExternalSchemaCompositionInput!) {
        enableExternalSchemaComposition(input: $input) {
          ok {
            endpoint
          }
          error {
            message
            inputErrors {
              endpoint
              secret
            }
          }
        }
      }
    `),
    variables: {
      input,
    },
    token,
  });
}
