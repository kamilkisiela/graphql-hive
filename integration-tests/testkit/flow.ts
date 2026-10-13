import { graphql } from './gql';
import type {
  AddAlertChannelInput,
  AddAlertInput,
  AddGroupMappingToGroupInput,
  AddMetricAlertRuleInput,
  AnswerOrganizationTransferRequestInput,
  AssignMemberRoleInput,
  ConfirmScimManagementForMemberInput,
  CreateContractInput,
  CreateMemberRoleInput,
  CreateOrganizationAccessTokenInput,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTargetInput,
  CreateTokenInput,
  DeleteContractInput,
  DeleteMemberRoleInput,
  DeleteMetricAlertRulesInput,
  DeleteTargetInput,
  DeleteTokensInput,
  Experimental__UpdateTargetSchemaCompositionInput,
  InviteToOrganizationByEmailInput,
  OrganizationMemberInput,
  OrganizationSelectorInput,
  OrganizationTransferRequestSelector,
  RateLimitInput,
  RemoveGroupMappingInput,
  RequestOrganizationTransferInput,
  SchemaCheckInput,
  SchemaDeleteInput,
  SchemaPublishInput,
  SchemaVersionPromoteInput,
  TargetSelectorInput,
  UpdateBaseSchemaInput,
  UpdateGroupMappingInput,
  UpdateMemberRoleInput,
  UpdateMetricAlertRuleInput,
  UpdateOidcIntegrationInput,
  UpdateOrganizationSlugInput,
  UpdateProjectSlugInput,
  UpdateSchemaCompositionInput,
  UpdateTargetConditionalBreakingChangeConfigurationInput,
  UpdateTargetSlugInput,
} from './gql/graphql';
import * as GraphQLSchema from './gql/graphql';
import { execute } from './graphql';

const LeaveOrganizationDocument = graphql(`
  mutation TestKit_LeaveOrganization($input: OrganizationSelectorInput!) {
    leaveOrganization(input: $input) {
      ok {
        organizationId
      }
      error {
        message
      }
    }
  }
`);

export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class PollTimeoutError extends Error {
  constructor(maxWait: number, attempts: number, lastError: unknown) {
    const lastFailure =
      lastError === undefined
        ? ''
        : `\nLast failure: ${lastError instanceof Error ? lastError.message : String(lastError)}`;
    super(
      `Polling failed. Condition was not satisfied within ${maxWait}ms (${attempts} attempts).${lastFailure}`,
      { cause: lastError },
    );
    this.name = 'PollTimeoutError';
  }
}

/**
 * Polls `check` until it resolves to `true`. A `check` that throws is retried like one that
 * resolves to `false`; the last error is reported when `maxWait` is exceeded.
 */
export function pollFor(
  check: () => Promise<boolean>,
  opts?: {
    /** In milliseconds */
    pollFrequency?: number;
    /** In milliseconds */
    maxWait?: number;
    /** In milliseconds. A random number between 0 and `jitter` is added to `pollFrequency` to add
     * some noise and prevent test cases where exact durations are required. */
    jitter?: number;
  },
): Promise<void> {
  const pollFrequency = opts?.pollFrequency ?? 500;
  const maxWait = opts?.maxWait ?? 15_000;
  const jitter = opts?.jitter ?? 100;
  const startTime = Date.now();
  let attempts = 0;
  let lastError: unknown;

  return new Promise((resolve, reject) => {
    function scheduleAttempt() {
      setTimeout(
        async () => {
          attempts++;
          try {
            if (await check()) {
              resolve();
              return;
            }
          } catch (error) {
            lastError = error;
          }

          if (Date.now() - startTime > maxWait) {
            reject(new PollTimeoutError(maxWait, attempts, lastError));
            return;
          }

          scheduleAttempt();
        },
        Math.round(pollFrequency + Math.random() * jitter),
      );
    }

    scheduleAttempt();
  });
}

// Use this function to give our backend (clickhouse) time to insert into the materialized views' tables
export const waitForExpectations = (expectation: () => Promise<void>) => {
  return pollFor(async () => {
    await expectation();
    return true;
  });
};

export async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
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
                slug
                owner {
                  id
                  role {
                    id
                    permissions
                  }
                }
                memberRoles {
                  edges {
                    node {
                      id
                      name
                      isLocked
                    }
                  }
                }
                usageRetentionInDays
              }
            }
          }
          error {
            message
            inputErrors {
              slug
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

export function getOrganization(organizationSlug: string, authToken: string) {
  return execute({
    document: graphql(`
      query getOrganization($organizationSlug: String!) {
        organization(reference: { bySelector: { organizationSlug: $organizationSlug } }) {
          id
          slug
          getStarted {
            creatingProject
            publishingSchema
            checkingSchema
            invitingMembers
            reportingOperations
            enablingUsageBasedBreakingChanges
          }
          me {
            id
            user {
              id
            }
            role {
              id
              name
              permissions
            }
          }
        }
      }
    `),
    authToken,
    variables: {
      organizationSlug,
    },
  });
}

export function inviteToOrganization(input: InviteToOrganizationByEmailInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation inviteToOrganization($input: InviteToOrganizationByEmailInput!) {
        inviteToOrganizationByEmail(input: $input) {
          ok {
            createdOrganizationInvitation {
              id
              createdAt
              expiresAt
              email
              code
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

export function updateOrganizationSlug(input: UpdateOrganizationSlugInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation updateOrganizationSlug($input: UpdateOrganizationSlugInput!) {
        updateOrganizationSlug(input: $input) {
          ok {
            updatedOrganizationPayload {
              selector {
                organizationSlug
              }
              organization {
                id
                name
                slug
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
              slug
              me {
                id
                user {
                  id
                }
                role {
                  id
                  name
                  permissions
                }
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

export function leaveOrganization(input: OrganizationSelectorInput, authToken: string) {
  return execute({
    document: LeaveOrganizationDocument,
    authToken,
    variables: { input },
  });
}

export function deleteOrganizationMember(input: OrganizationMemberInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation DeleteOrganizationMember($input: OrganizationMemberInput!) {
        deleteOrganizationMember(input: $input) {
          organization {
            id
          }
        }
      }
    `),
    authToken,
    variables: { input },
  });
}

export function getOrganizationMembers(selector: OrganizationSelectorInput, authToken: string) {
  return execute({
    document: graphql(`
      query getOrganizationMembers($selector: OrganizationSelectorInput!) {
        organization(reference: { bySelector: $selector }) {
          members {
            edges {
              node {
                id
                user {
                  id
                  email
                }
                role {
                  id
                  name
                  permissions
                }
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

export function getOrganizationProjects(selector: OrganizationSelectorInput, authToken: string) {
  return execute({
    document: graphql(`
      query getOrganizationProjects($selector: OrganizationSelectorInput!) {
        organization(reference: { bySelector: $selector }) {
          projects {
            edges {
              node {
                id
                slug
                name
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
              slug
              name
              createdAt
            }
            createdTargets {
              id
              slug
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

export function updateProjectSlug(input: UpdateProjectSlugInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation updateProjectSlug($input: UpdateProjectSlugInput!) {
        updateProjectSlug(input: $input) {
          ok {
            updatedProject {
              id
              name
              slug
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

export function createTarget(input: CreateTargetInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation createTarget($input: CreateTargetInput!) {
        createTarget(input: $input) {
          ok {
            createdTarget {
              id
              slug
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

export function updateTargetSlug(input: UpdateTargetSlugInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation updateTargetSlug($input: UpdateTargetSlugInput!) {
        updateTargetSlug(input: $input) {
          ok {
            selector {
              organizationSlug
              projectSlug
              targetSlug
            }
            target {
              id
              slug
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

export function addAlertChannel(input: AddAlertChannelInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation IntegrationTests_AddAlertChannel($input: AddAlertChannelInput!) {
        addAlertChannel(input: $input) {
          ok {
            addedAlertChannel {
              id
              name
              type
              ... on AlertSlackChannel {
                channel
              }
              ... on AlertWebhookChannel {
                endpoint
              }
              ... on TeamsWebhookChannel {
                endpoint
              }
              ... on DiscordWebhookChannel {
                endpoint
              }
            }
          }
          error {
            message
            inputErrors {
              webhookEndpoint
              slackChannel
              name
            }
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

export function addAlert(input: AddAlertInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation IntegrationTests_AddAlert($input: AddAlertInput!) {
        addAlert(input: $input) {
          ok {
            addedAlert {
              id
              type
              channel {
                id
                name
                type
              }
              target {
                id
                slug
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

export function addMetricAlertRule(input: AddMetricAlertRuleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation IntegrationTests_AddMetricAlertRule($input: AddMetricAlertRuleInput!) {
        addMetricAlertRule(input: $input) {
          ok {
            addedMetricAlertRule {
              id
              name
              type
              metric
              thresholdType
              thresholdValue
              direction
              severity
              state
              timeWindowMinutes
              confirmationMinutes
              enabled
              channels {
                id
                name
                type
              }
            }
          }
          error {
            message
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function updateMetricAlertRule(input: UpdateMetricAlertRuleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation IntegrationTests_UpdateMetricAlertRule($input: UpdateMetricAlertRuleInput!) {
        updateMetricAlertRule(input: $input) {
          ok {
            updatedMetricAlertRule {
              id
              name
              type
              metric
              thresholdType
              thresholdValue
              direction
              severity
              state
              enabled
            }
          }
          error {
            message
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function deleteMetricAlertRules(input: DeleteMetricAlertRulesInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation IntegrationTests_DeleteMetricAlertRules($input: DeleteMetricAlertRulesInput!) {
        deleteMetricAlertRules(input: $input) {
          ok {
            deletedMetricAlertRuleIds
          }
          error {
            message
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function readOrganizationInfo(
  selector: {
    organizationSlug: string;
  },
  authToken: string,
) {
  return execute({
    document: graphql(`
      query readOrganizationInfo($selector: OrganizationSelectorInput!) {
        organization(reference: { bySelector: $selector }) {
          id
          slug
        }
      }
    `),
    authToken,
    variables: {
      selector,
    },
  });
}

export function readProjectInfo(
  selector: {
    organizationSlug: string;
    projectSlug: string;
  },
  authToken: string,
) {
  return execute({
    document: graphql(`
      query readProjectInfo($selector: ProjectSelectorInput!) {
        project(reference: { bySelector: $selector }) {
          id
          slug
          createdAt
        }
      }
    `),
    authToken,
    variables: {
      selector,
    },
  });
}

export function readTargetInfo(
  selector: {
    organizationSlug: string;
    projectSlug: string;
    targetSlug: string;
  },
  authToken: string,
) {
  return execute({
    document: graphql(`
      query readTargetInfo($selector: TargetSelectorInput!) {
        target(reference: { bySelector: $selector }) {
          id
          slug
        }
      }
    `),
    authToken,
    variables: {
      selector,
    },
  });
}

export function createMemberRole(input: CreateMemberRoleInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation createMemberRole($input: CreateMemberRoleInput!) {
        createMemberRole(input: $input) {
          ok {
            createdMemberRole {
              id
            }
            updatedOrganization {
              id
              slug
              memberRoles {
                edges {
                  node {
                    id
                    name
                    description
                    isLocked
                    permissions
                  }
                }
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
              slug
              memberRoles {
                edges {
                  node {
                    id
                    name
                    description
                    isLocked
                    permissions
                  }
                }
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
              isLocked
              permissions
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

export function schemaVersionPromote(input: SchemaVersionPromoteInput, accessToken: string) {
  return execute({
    document: graphql(`
      mutation TestKit_PromoteSchema($input: SchemaVersionPromoteInput!) {
        schemaVersionPromote(input: $input) {
          ok {
            newSchemaVersion {
              id
            }
          }
          error {
            message
          }
        }
      }
    `),
    token: accessToken,
    variables: {
      input,
    },
  });
}

export function createContract(input: CreateContractInput, accessToken: string) {
  return execute({
    document: graphql(`
      mutation TestKit_CreateContract($input: CreateContractInput!) {
        createContract(input: $input) {
          ok {
            createdContract {
              id
              target {
                id
              }
              includeTags
              excludeTags
              createdAt
            }
          }
          error {
            message
            details {
              target
              contractName
              includeTags
              excludeTags
            }
          }
        }
      }
    `),
    variables: {
      input,
    },
    token: accessToken,
  });
}

export function deleteContract(input: DeleteContractInput, accessToken: string) {
  return execute({
    document: graphql(`
      mutation TestKit_DeleteContract($input: DeleteContractInput!) {
        deleteContract(input: $input) {
          ok {
            deletedContractId
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
    token: accessToken,
  });
}

export function getSchemaVersionWithAllDetails(
  targetId: string,
  schemaVersionId: string,
  accessToken: string,
) {
  return execute({
    document: graphql(`
      query TestKit_SchemaVersion($targetReference: TargetReferenceInput!, $schemaVersionId: ID!) {
        target(reference: $targetReference) {
          schemaVersion(id: $schemaVersionId) {
            id
            isValid
            origin {
              __typename
              ... on SchemaVersionPromoteOrigin {
                schemaVersionId
              }
              ... on SchemaVersionPublishOrigin {
                publishedSubgraphs {
                  name
                }
              }
              ... on SchemaVersionSubgraphRemoveOrigin {
                removedSubgraphs {
                  name
                }
              }
            }
            supergraph
            sdl
            meta {
              author
              commit
            }
            subgraphDiffs {
              __typename
              ... on SubgraphDiffAdded {
                subgraphVersion {
                  id
                  revision
                  sdl
                  serviceName
                }
              }
              ... on SubgraphDiffChanged {
                subgraphVersion {
                  id
                  revision
                  sdl
                  serviceName
                }
                previousSubgraphVersion {
                  id
                  revision
                  sdl
                  serviceName
                }
                changes {
                  edges {
                    node {
                      message
                    }
                  }
                }
              }
              ... on SubgraphDiffRemoved {
                removedSubgraphVersion {
                  id
                  revision
                  sdl
                  serviceName
                }
              }
              ... on SubgraphDiffUnchanged {
                subgraphVersion {
                  id
                  revision
                  sdl
                  serviceName
                }
              }
            }
            previousDiffableSchemaVersion {
              id
            }
            contractVersions {
              edges {
                node {
                  id
                  contractName
                  supergraphSDL
                  compositeSchemaSDL
                  previousContractVersion {
                    id
                  }
                  breakingSchemaChanges {
                    edges {
                      node {
                        message
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `),
    variables: {
      targetReference: {
        byId: targetId,
      },
      schemaVersionId,
    },
    authToken: accessToken,
  })
    .then(r => r.expectNoGraphQLErrors())
    .then(r => r.target?.schemaVersion ?? null);
}

export async function getLatestSchemaCheck(
  projectRef: GraphQLSchema.ProjectReferenceInput,
  targetSlug: string,
  token: string,
) {
  const res = await execute({
    document: graphql(`
      query getLatestCheck($projectRef: ProjectReferenceInput!, $targetSlug: String!) {
        project(reference: $projectRef) {
          targetBySlug(targetSlug: $targetSlug) {
            schemaChecks(first: 1) {
              edges {
                node {
                  __typename
                  id
                }
              }
            }
          }
        }
      }
    `),
    token,
    variables: {
      projectRef,
      targetSlug,
    },
  }).then(r => r.expectNoGraphQLErrors());
  return res.project?.targetBySlug?.schemaChecks?.edges?.[0]?.node?.id;
}

export function getSchemaCheckDetails(
  reference: GraphQLSchema.TargetReferenceInput,
  checkId: string,
  token: string,
) {
  return execute({
    document: graphql(`
      query getCheck($reference: TargetReferenceInput!, $checkId: ID!) {
        target(reference: $reference) {
          schemaCheck(id: $checkId) {
            __typename
            id
            contextId
            meta {
              author
              commit
            }
            baseline {
              meta {
                commit
              }
            }
            schemaSDL
            previousSchemaSDL
            ... on SuccessfulSchemaCheck {
              supergraphSDL
              compositeSchemaSDL
            }
            schemaVersion {
              supergraph
              sdl
            }
          }
        }
      }
    `),
    token,
    variables: {
      reference,
      checkId,
    },
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
              __typename
              id
              previousSchemaSDL
              baseline {
                sdl
                supergraphSdl
                publicSdl
                compositionErrors {
                  message
                  path
                }
                meta {
                  commit
                }
              }
              schemaVersion {
                id
              }
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
              previousSchemaSDL
              baseline {
                sdl
                supergraphSdl
                publicSdl
                compositionErrors {
                  message
                  path
                }
                meta {
                  commit
                }
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

export function updateTargetValidationSettings(
  input: UpdateTargetConditionalBreakingChangeConfigurationInput,
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
      mutation updateTargetConditionalBreakingChangeConfiguration(
        $input: UpdateTargetConditionalBreakingChangeConfigurationInput!
      ) {
        updateTargetConditionalBreakingChangeConfiguration(input: $input) {
          ok {
            target {
              id
              conditionalBreakingChangeConfiguration {
                isEnabled
                period
                percentage
                targets {
                  id
                }
                excludedClients
                excludedAppDeployments
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

export function updateTargetDangerousChangeClassification(
  input: GraphQLSchema.UpdateTargetDangerousChangeClassificationInput,
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
      mutation UpdateTargetDangerousChangeClassification(
        $input: UpdateTargetDangerousChangeClassificationInput!
      ) {
        updateTargetDangerousChangeClassification(input: $input) {
          ok {
            target {
              id
            }
          }
          error {
            message
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

export function updateTargetFailingDangerousChanges(
  input: GraphQLSchema.UpdateTargetFailingDangerousChangesInput,
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
      mutation UpdateTargetFailingDangerousChanges(
        $input: UpdateTargetFailingDangerousChangesInput!
      ) {
        updateTargetFailingDangerousChanges(input: $input) {
          ok {
            target {
              id
              failAllDangerousChanges
              failDangerousChangeTypes
            }
          }
          error {
            message
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

export function readTotalRequests(
  reference: GraphQLSchema.TargetReferenceInput,
  period: GraphQLSchema.DateRangeInput,
  token: string,
) {
  return execute({
    document: graphql(`
      query IntegrationTests_ReadTotalRequests(
        $reference: TargetReferenceInput!
        $period: DateRangeInput!
      ) {
        target(reference: $reference) {
          totalRequests(period: $period)
        }
      }
    `),
    token,
    variables: {
      reference,
      period,
    },
  });
}

export function readClientStats(
  reference: GraphQLSchema.TargetReferenceInput,
  period: GraphQLSchema.DateRangeInput,
  clientName: string,
  token: string,
) {
  return execute({
    document: graphql(`
      query IntegrationTests_ClientStat(
        $reference: TargetReferenceInput!
        $period: DateRangeInput!
        $clientName: String!
      ) {
        target(reference: $reference) {
          clientStats(period: $period, clientName: $clientName) {
            totalRequests
            totalVersions
            operations {
              edges {
                node {
                  id
                  name
                  operationHash
                  count
                }
              }
            }
            versions(limit: 25) {
              version
              count
            }
          }
        }
      }
    `),
    token,
    variables: {
      reference,
      period,
      clientName,
    },
  });
}

export function readOperationsStats(
  target: GraphQLSchema.TargetReferenceInput,
  period: GraphQLSchema.DateRangeInput,
  filter: GraphQLSchema.OperationStatsFilterInput,
  token: string,
) {
  return execute({
    document: graphql(`
      query readOperationsStats(
        $target: TargetReferenceInput!
        $period: DateRangeInput!
        $filter: OperationStatsFilterInput
      ) {
        target(reference: $target) {
          operationsStats(period: $period, filter: $filter) {
            totalOperations
            operations {
              edges {
                node {
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
            clients {
              edges {
                node {
                  name
                  versions {
                    version
                    count
                  }
                  count
                }
              }
            }
          }
        }
      }
    `),
    token,
    variables: {
      target,
      period,
      filter,
    },
  });
}

export function readErrorCodes(
  coordinate: string,
  target: GraphQLSchema.TargetReferenceInput,
  period: GraphQLSchema.DateRangeInput,
  token: string,
) {
  return execute({
    document: graphql(`
      query readErrorCodes(
        $coordinate: String!
        $target: TargetReferenceInput!
        $period: DateRangeInput!
      ) {
        target(reference: $target) {
          schemaCoordinateStats(schemaCoordinate: $coordinate, period: $period) {
            errorCodes {
              edges {
                node {
                  code
                }
              }
            }
          }
        }
      }
    `),
    token,
    variables: {
      target,
      period,
      coordinate,
    },
  });
}

export function readSchemaCoordinateStats(
  selector: {
    organizationSlug: string;
    projectSlug: string;
    targetSlug: string;
    schemaCoordinate: string;
  },
  period: GraphQLSchema.DateRangeInput,
  token: string,
) {
  return execute({
    document: graphql(`
      query readSchemaCoordinateStats(
        $selector: TargetSelectorInput!
        $schemaCoordinate: String!
        $period: DateRangeInput!
      ) {
        target(reference: { bySelector: $selector }) {
          id
          schemaCoordinateStats(schemaCoordinate: $schemaCoordinate, period: $period) {
            totalRequests
            totalResolutions
            totalFailures
          }
        }
      }
    `),
    token,
    variables: {
      selector: {
        organizationSlug: selector.organizationSlug,
        projectSlug: selector.projectSlug,
        targetSlug: selector.targetSlug,
      },
      schemaCoordinate: selector.schemaCoordinate,
      period,
    },
  });
}

export function readOperationBody(
  selector: {
    organizationSlug: string;
    projectSlug: string;
    targetSlug: string;
    hash: string;
  },
  token: string,
) {
  return execute({
    document: graphql(`
      query readOperationBody($selector: TargetSelectorInput!, $hash: ID!) {
        target(reference: { bySelector: $selector }) {
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
        organizationSlug: selector.organizationSlug,
        projectSlug: selector.projectSlug,
        targetSlug: selector.targetSlug,
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
          id
          baseSchema
          meta {
            author
            commit
          }
          origin {
            __typename
            ... on SchemaVersionPromoteOrigin {
              schemaVersionId
            }
            ... on SchemaVersionPublishOrigin {
              publishedSubgraphs {
                name
                versionId
              }
            }
            ... on SchemaVersionSubgraphRemoveOrigin {
              removedSubgraphs {
                name
                versionId
              }
            }
          }
          isValid
          sdl
          supergraph
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
          meta {
            author
            commit
          }
          origin {
            __typename
            ... on SchemaVersionPromoteOrigin {
              schemaVersionId
            }
            ... on SchemaVersionPublishOrigin {
              publishedSubgraphs {
                name
              }
            }
            ... on SchemaVersionSubgraphRemoveOrigin {
              removedSubgraphs {
                name
              }
            }
          }
          tags
          sdl
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
        target(reference: { bySelector: $selector }) {
          schemaVersions(first: $first) {
            edges {
              node {
                id
                origin {
                  __typename
                  ... on SchemaVersionPromoteOrigin {
                    schemaVersionId
                  }
                }
                valid
                supergraph
                sdl
                previousDiffableSchemaVersion {
                  id
                }
                date
                origin {
                  __typename
                  ... on SchemaVersionPromoteOrigin {
                    schemaVersionId
                    targetSlug
                    targetId
                  }
                  ... on SchemaVersionPublishOrigin {
                    publishedSubgraphs {
                      name
                    }
                  }
                  ... on SchemaVersionSubgraphRemoveOrigin {
                    removedSubgraphs {
                      name
                    }
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
    organizationSlug: string;
    projectSlug: string;
    targetSlug: string;
    version: string;
  },
  token: string,
) {
  return execute({
    document: graphql(`
      query compareToPreviousVersion(
        $organizationSlug: String!
        $projectSlug: String!
        $targetSlug: String!
        $version: ID!
      ) {
        target(
          reference: {
            bySelector: {
              organizationSlug: $organizationSlug
              projectSlug: $projectSlug
              targetSlug: $targetSlug
            }
          }
        ) {
          id
          schemaVersion(id: $version) {
            id
            sdl
            supergraph
            origin {
              __typename
              ... on SchemaVersionPromoteOrigin {
                schemaVersionId
              }
              ... on SchemaVersionPublishOrigin {
                publishedSubgraphs {
                  name
                }
              }
              ... on SchemaVersionSubgraphRemoveOrigin {
                removedSubgraphs {
                  name
                }
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
      input: { target: { bySelector: selector }, alias: 'CDN Access Token' },
    },
  });
}

export async function fetchSchemaFromCDN(cdnUrl: string, secretAccessToken: string) {
  const res = await fetch(cdnUrl + '/sdl', {
    headers: {
      'X-Hive-CDN-Key': secretAccessToken,
    },
  });

  return {
    body: await res.text(),
    status: res.status,
  };
}

export async function fetchSupergraphFromCDN(cdnUrl: string, secretAccessToken: string) {
  const res = await fetch(cdnUrl + '/supergraph', {
    headers: {
      'X-Hive-CDN-Key': secretAccessToken,
    },
  });

  const textBody = await res.text();

  return {
    body: textBody,
    status: res.status,
  };
}

export async function fetchMetadataFromCDN(cdnUrl: string, secretAccessToken: string) {
  const res = await fetch(cdnUrl + '/metadata', {
    headers: {
      Accept: 'application/json',
      'X-Hive-CDN-Key': secretAccessToken,
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

export async function updateSchemaComposition(input: UpdateSchemaCompositionInput, token: string) {
  return execute({
    document: graphql(`
      mutation updateSchemaComposition($input: UpdateSchemaCompositionInput!) {
        updateSchemaComposition(input: $input) {
          ok {
            updatedProject {
              id
              externalSchemaComposition {
                endpoint
              }
            }
          }
          error {
            ... on UpdateSchemaCompositionExternalError {
              message
              inputErrors {
                endpoint
                secret
              }
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

export async function updateTargetSchemaComposition(
  input: Experimental__UpdateTargetSchemaCompositionInput,
  token: string,
) {
  return execute({
    document: graphql(`
      mutation experimental__updateTargetSchemaComposition(
        $input: Experimental__UpdateTargetSchemaCompositionInput!
      ) {
        experimental__updateTargetSchemaComposition(input: $input) {
          id
        }
      }
    `),
    variables: {
      input,
    },
    token,
  });
}

export function createOrganizationAccessToken(
  input: CreateOrganizationAccessTokenInput,
  authToken: string,
) {
  return execute({
    document: graphql(`
      mutation CreateOrganizationAccessToken($input: CreateOrganizationAccessTokenInput!) {
        createOrganizationAccessToken(input: $input) {
          ok {
            privateAccessKey
            createdOrganizationAccessToken {
              id
              title
              description
              permissions
              createdAt
            }
          }
          error {
            message
            details {
              title
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

export function deleteTarget(input: DeleteTargetInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation DeleteToken_Testkit($input: DeleteTargetInput!) {
        deleteTarget(input: $input) {
          ok {
            deletedTargetId
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

export function createOIDCIntegration(
  input: GraphQLSchema.CreateOidcIntegrationInput,
  authToken: string,
) {
  return execute({
    document: graphql(`
      mutation TestKit_CreateOIDCIntegrationMutation($input: CreateOIDCIntegrationInput!) {
        createOIDCIntegration(input: $input) {
          ok {
            createdOIDCIntegration {
              id
              clientId
              clientSecretPreview
              tokenEndpoint
              userinfoEndpoint
              authorizationEndpoint
              additionalScopes
              oidcUserJoinOnly
              oidcUserAccessOnly
            }
          }
          error {
            message
            details {
              clientId
              clientSecret
              tokenEndpoint
              userinfoEndpoint
              authorizationEndpoint
              additionalScopes
            }
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function confirmSCIMManagementForMember(
  input: ConfirmScimManagementForMemberInput,
  authToken: string,
) {
  return execute({
    document: graphql(`
      mutation TestKit_ConfirmSCIMManagementForMember(
        $input: ConfirmSCIMManagementForMemberInput!
      ) {
        confirmSCIMManagementForMember(input: $input) {
          ok {
            confirmedMember {
              id
              user {
                id
                provisionInfo {
                  provisioningStatus
                }
              }
            }
          }
          error {
            message
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function updateOIDCIntegration(input: UpdateOidcIntegrationInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation TestKit_OIDCIntegration_UpdateOIDCIntegrationMutation(
        $input: UpdateOIDCIntegrationInput!
      ) {
        updateOIDCIntegration(input: $input) {
          ok {
            updatedOIDCIntegration {
              id
              tokenEndpoint
              userinfoEndpoint
              authorizationEndpoint
              clientId
              clientSecretPreview
              additionalScopes
            }
          }
          error {
            message
            details {
              clientId
              clientSecret
              tokenEndpoint
              userinfoEndpoint
              authorizationEndpoint
              additionalScopes
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

export function updateOIDCRestrictions(
  input: GraphQLSchema.UpdateOidcRestrictionsInput,
  authToken: string,
) {
  return execute({
    document: graphql(`
      mutation TestKit_UpdateOIDCRestrictionsMutation($input: UpdateOIDCRestrictionsInput!) {
        updateOIDCRestrictions(input: $input) {
          ok {
            updatedOIDCIntegration {
              id
              oidcUserJoinOnly
              oidcUserAccessOnly
              userProvisioningRequired
              oidcForVerifiedDomainsRequired
            }
          }
          error {
            message
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function getGroupForOrganization(
  organizationId: string,
  groupId: string,
  authToken: string,
) {
  return execute({
    authToken,
    variables: {
      organizationId,
      groupId,
    },
    document: graphql(`
      query TestKit_GroupForOrganization($organizationId: ID!, $groupId: ID!) {
        organization(reference: { byId: $organizationId }) {
          id
          group(id: $groupId) {
            id
            name
            roleMappingCount
            roleMappings {
              id
              role {
                id
                name
              }
            }
            memberCount
          }
        }
      }
    `),
  });
}

export function getPaginatedGroupsForOrganization(
  authToken: string,
  organizationId: string,
  first: number,
  after: string | null,
  searchTerm: string | null = null,
) {
  return execute({
    authToken,
    variables: {
      organizationId,
      first,
      after,
      searchTerm,
    },
    document: graphql(`
      query TestKit_PaginatedGroupsForOrganization(
        $organizationId: ID!
        $first: Int!
        $after: String
        $searchTerm: String
      ) {
        organization(reference: { byId: $organizationId }) {
          id
          groups(first: $first, after: $after, filters: { searchTerm: $searchTerm }) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `),
  });
}

export function addGroupMappingToGroup(input: AddGroupMappingToGroupInput, authToken: string) {
  return execute({
    authToken,
    variables: {
      input,
    },
    document: graphql(`
      mutation TestKit_CreateGroupRoleMapping($input: AddGroupMappingToGroupInput!) {
        addGroupMappingToGroup(input: $input) {
          ok {
            group {
              id
              roleMappings {
                id
                role {
                  id
                  name
                }
              }
            }
          }
          error {
            message
          }
        }
      }
    `),
  });
}

export function updateGroupMapping(input: UpdateGroupMappingInput, authToken: string) {
  return execute({
    authToken,
    variables: {
      input,
    },
    document: graphql(`
      mutation TestKit_UpdateGroupMapping($input: UpdateGroupMappingInput!) {
        updateGroupMapping(input: $input) {
          ok {
            group {
              id
              roleMappings {
                id
                role {
                  id
                  name
                }
              }
            }
          }
          error {
            message
          }
        }
      }
    `),
  });
}

export function removeGroupMapping(input: RemoveGroupMappingInput, authToken: string) {
  return execute({
    authToken,
    variables: {
      input,
    },
    document: graphql(`
      mutation TestKit_RemoveGroupMapping($input: RemoveGroupMappingInput!) {
        removeGroupMapping(input: $input) {
          error {
            message
          }
          ok {
            group {
              id
              roleMappings {
                id
              }
            }
          }
        }
      }
    `),
  });
}

export function createPersonalAccessToken(
  input: GraphQLSchema.CreatePersonalAccessTokenInput,
  authToken: string,
) {
  return execute({
    authToken,
    variables: {
      input,
    },
    document: graphql(`
      mutation TestKit_CreatePersonalAccessTokenMutation($input: CreatePersonalAccessTokenInput!) {
        createPersonalAccessToken(input: $input) {
          ok {
            privateAccessKey
            createdPersonalAccessToken {
              id
              title
              description
              createdAt
            }
          }
          error {
            message
            details {
              title
              description
            }
          }
        }
      }
    `),
  });
}

export function updateMe(input: GraphQLSchema.UpdateMeInput, authToken: string) {
  return execute({
    document: graphql(`
      mutation TestKit_UpdateMeMutation($input: UpdateMeInput!) {
        updateMe(input: $input) {
          error {
            message
          }
          ok {
            updatedUser {
              id
              displayName
              fullName
            }
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}

export function schemaPush(input: GraphQLSchema.SchemaPushInput, authToken: string) {
  return execute({
    document: graphql(/* GraphQL */ `
      mutation TestKit_SchemaPush($input: SchemaPushInput!) {
        schemaPush(input: $input) {
          ok {
            schemaRevision {
              id
              service
              revision
              digest
              expiresAt
            }
          }
          error {
            message
          }
        }
      }
    `),
    variables: { input },
    authToken,
  });
}
