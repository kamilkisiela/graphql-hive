import { graphql } from './gql';
import type {
  AnswerOrganizationTransferRequestInput,
  AssignMemberRoleInput,
  CreateMemberRoleInput,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTargetInput,
  CreateTokenInput,
  DeleteMemberRoleInput,
  DeleteTokensInput,
  EnableExternalSchemaCompositionInput,
  InviteToOrganizationByEmailInput,
  OperationsStatsSelectorInput,
  OrganizationSelectorInput,
  OrganizationTransferRequestSelector,
  RateLimitInput,
  RequestOrganizationTransferInput,
  SchemaCheckInput,
  SchemaDeleteInput,
  SchemaPublishInput,
  SchemaVersionUpdateInput,
  SetTargetValidationInput,
  TargetSelectorInput,
  UpdateBaseSchemaInput,
  UpdateMemberRoleInput,
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
    document: graphql(`
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
                memberRoles {
                  id
                  name
                  locked
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
    document: graphql(`
      query getOrganization($organizationId: ID!) {
        organization(selector: { organization: $organizationId }) {
          organization {
            id
            cleanId
            name
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
      query getOrganizationMembers($selector: OrganizationSelectorInput!) {
        organization(selector: $selector) {
          organization {
            members {
              nodes {
                id
                user {
                  id
                  email
                }
                role {
                  id
                  name
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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
    document: graphql(`
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

export function createMemberRole(input: CreateMemberRoleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation createMemberRole($input: CreateMemberRoleInput!) {
        createMemberRole(input: $input) {
          ok {
            updatedOrganization {
              id
              cleanId
              memberRoles {
                id
                name
                description
                locked
                organizationAccessScopes
                projectAccessScopes
                targetAccessScopes
              }
            }
          }
          error {
            message
            inputErrors {
              name
              description
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

export function assignMemberRole(input: AssignMemberRoleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation assignMemberRole($input: AssignMemberRoleInput!) {
        assignMemberRole(input: $input) {
          ok {
            updatedMember {
              id
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

export function deleteMemberRole(input: DeleteMemberRoleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation deleteMemberRole($input: DeleteMemberRoleInput!) {
        deleteMemberRole(input: $input) {
          ok {
            updatedOrganization {
              id
              cleanId
              memberRoles {
                id
                name
                description
                locked
                organizationAccessScopes
                projectAccessScopes
                targetAccessScopes
              }
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

export function updateMemberRole(input: UpdateMemberRoleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation updateMemberRole($input: UpdateMemberRoleInput!) {
        updateMemberRole(input: $input) {
          ok {
            updatedRole {
              id
              name
              description
              locked
              organizationAccessScopes
              projectAccessScopes
              targetAccessScopes
            }
          }
          error {
            message
            inputErrors {
              name
              description
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
    document: graphql(`
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
    document: graphql(`
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
            schemaCheck {
              id
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
            schemaCheck {
              id
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

export function deleteSchema(
  input: SchemaDeleteInput,
  token: string,
  authHeader?: 'x-api-token' | 'authorization',
) {
  return execute({
    document: graphql(`
      mutation schemaDelete($input: SchemaDeleteInput!) {
        schemaDelete(input: $input) {
          __typename
          ... on SchemaDeleteSuccess {
            valid
            changes {
              nodes {
                criticality
                message
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
          ... on SchemaDeleteError {
            valid
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
    document: graphql(`
      mutation setTargetValidation($input: SetTargetValidationInput!) {
        setTargetValidation(input: $input) {
          id
          validationSettings {
            enabled
            period
            percentage
            excludedClients
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
    document: graphql(`
      mutation updateTargetValidationSettings($input: UpdateTargetValidationSettingsInput!) {
        updateTargetValidationSettings(input: $input) {
          ok {
            target {
              id
              validationSettings {
                enabled
                period
                percentage
                targets {
                  id
                }
                excludedClients
              }
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
    document: graphql(`
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
    document: graphql(`
      query readOperationsStats($input: OperationsStatsSelectorInput!) {
        operationsStats(selector: $input) {
          totalOperations
          operations {
            nodes {
              id
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

export function readOperationBody(
  selector: {
    organization: string;
    project: string;
    target: string;
    hash: string;
  },
  token: string,
) {
  return execute({
    document: graphql(`
      query readOperationBody($selector: TargetSelectorInput!, $hash: String!) {
        target(selector: $selector) {
          id
          operation(hash: $hash) {
            body
          }
        }
      }
    `),
    token,
    variables: {
      selector: {
        organization: selector.organization,
        project: selector.project,
        target: selector.target,
      },
      hash: selector.hash,
    },
  });
}

export function fetchLatestSchema(token: string) {
  return execute({
    document: graphql(`
      query latestVersion {
        latestVersion {
          baseSchema
          log {
            ... on PushedSchemaLog {
              __typename
              commit
              service
            }
            ... on DeletedSchemaLog {
              __typename
              deletedService
            }
          }
          schemas {
            nodes {
              ... on SingleSchema {
                source
                commit
              }
              ... on CompositeSchema {
                source
                commit
                url
              }
            }
            total
          }
          errors: schemaCompositionErrors {
            nodes {
              message
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
    document: graphql(`
      query latestValidVersion {
        latestValidVersion {
          id
          baseSchema
          log {
            ... on PushedSchemaLog {
              __typename
              commit
              service
            }
            ... on DeletedSchemaLog {
              __typename
              deletedService
            }
          }
          tags
          schemas {
            nodes {
              ... on SingleSchema {
                __typename
                source
                commit
              }
              ... on CompositeSchema {
                __typename
                source
                commit
                url
              }
            }
            total
          }
        }
      }
    `),
    token,
  });
}

export function fetchVersions(selector: TargetSelectorInput, first: number, token: string) {
  return execute({
    document: graphql(`
      query schemaVersions($first: Int!, $selector: TargetSelectorInput!) {
        target(selector: $selector) {
          schemaVersions(first: $first) {
            edges {
              node {
                id
                valid
                date
                log {
                  ... on PushedSchemaLog {
                    __typename
                    commit
                    service
                  }
                  ... on DeletedSchemaLog {
                    __typename
                    deletedService
                  }
                }
                baseSchema
                schemas {
                  nodes {
                    ... on SingleSchema {
                      __typename
                      source
                      commit
                    }
                    ... on CompositeSchema {
                      __typename
                      source
                      commit
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    `),
    token,
    variables: {
      selector,
      first,
    },
  });
}

export function compareToPreviousVersion(
  selector: {
    organization: string;
    project: string;
    target: string;
    version: string;
  },
  token: string,
) {
  return execute({
    document: graphql(`
      query SchemaCompareToPreviousVersionQuery(
        $organization: ID!
        $project: ID!
        $target: ID!
        $version: ID!
      ) {
        target(selector: { organization: $organization, project: $project, target: $target }) {
          id
          schemaVersion(id: $version) {
            id
            sdl
            supergraph
            log {
              ... on PushedSchemaLog {
                id
                author
                service
                commit
                serviceSdl
                previousServiceSdl
              }
              ... on DeletedSchemaLog {
                id
                deletedService
                previousServiceSdl
              }
            }
            schemaCompositionErrors {
              nodes {
                message
              }
            }
            isFirstComposableVersion
            breakingSchemaChanges {
              nodes {
                message(withSafeBasedOnUsageNote: false)
                criticality
                criticalityReason
                path
                approval {
                  approvedBy {
                    id
                    displayName
                  }
                  approvedAt
                  schemaCheckId
                }
                isSafeBasedOnUsage
              }
            }
            safeSchemaChanges {
              nodes {
                message(withSafeBasedOnUsageNote: false)
                criticality
                criticalityReason
                path
                approval {
                  approvedBy {
                    id
                    displayName
                  }
                  approvedAt
                  schemaCheckId
                }
                isSafeBasedOnUsage
              }
            }
            previousDiffableSchemaVersion {
              id
              supergraph
              sdl
            }
          }
        }
      }
    `),
    token,
    variables: {
      ...selector,
    },
  });
}

export function updateSchemaVersionStatus(input: SchemaVersionUpdateInput, token: string) {
  return execute({
    document: graphql(`
      mutation updateSchemaVersionStatus($input: SchemaVersionUpdateInput!) {
        updateSchemaVersionStatus(input: $input) {
          id
          date
          valid
          log {
            ... on PushedSchemaLog {
              __typename
              commit
              service
            }
            ... on DeletedSchemaLog {
              __typename
              deletedService
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

export function createCdnAccess(selector: TargetSelectorInput, token: string) {
  return execute({
    document: graphql(`
      mutation createCdnAccessToken($input: CreateCdnAccessTokenInput!) {
        createCdnAccessToken(input: $input) {
          ok {
            secretAccessToken
            cdnUrl
          }
          error {
            message
          }
        }
      }
    `),
    token,
    variables: {
      input: { selector, alias: 'CDN Access Token' },
    },
  });
}

export async function fetchSchemaFromCDN(selector: TargetSelectorInput, token: string) {
  const cdnAccessResult = await createCdnAccess(selector, token).then(r =>
    r.expectNoGraphQLErrors(),
  );

  const cdn = cdnAccessResult.createCdnAccessToken.ok!;

  const res = await fetch(cdn.cdnUrl + '/sdl', {
    headers: {
      'X-Hive-CDN-Key': cdn.secretAccessToken,
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

  const cdn = cdnAccessResult.createCdnAccessToken.ok!;

  const res = await fetch(cdn.cdnUrl + '/supergraph', {
    headers: {
      'X-Hive-CDN-Key': cdn.secretAccessToken,
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

  const cdn = cdnAccessResult.createCdnAccessToken.ok!;

  const res = await fetch(cdn.cdnUrl + '/metadata', {
    headers: {
      Accept: 'application/json',
      'X-Hive-CDN-Key': cdn.secretAccessToken,
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
    document: graphql(`
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
    document: graphql(`
      mutation enableExternalSchemaComposition($input: EnableExternalSchemaCompositionInput!) {
        enableExternalSchemaComposition(input: $input) {
          ok {
            id
            externalSchemaComposition {
              endpoint
            }
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
