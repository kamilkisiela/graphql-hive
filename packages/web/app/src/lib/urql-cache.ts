import { DocumentNode, Kind } from 'graphql';
import { produce } from 'immer';
import { TypedDocumentNode } from 'urql';
import type { CreateProjectMutation } from '@/components/layouts/organization';
import type { CreateTarget_CreateTargetMutation } from '@/components/layouts/project';
import type { OrganizationMemberRow_DeleteMember } from '@/components/organization/members/list';
import type { CreateAlertModal_AddAlertMutation } from '@/components/project/alerts/create-alert';
import type { CreateChannel_AddAlertChannelMutation } from '@/components/project/alerts/create-channel';
import type { DeleteAlertsButton_DeleteAlertsMutation } from '@/components/project/alerts/delete-alerts-button';
import type { DeleteChannelsButton_DeleteChannelsMutation } from '@/components/project/alerts/delete-channels-button';
import type { AlertForm_AddMetricAlertRuleMutation } from '@/components/target/alerts/alert-form';
import type { CreateOperationMutationType } from '@/components/target/laboratory/create-operation-modal';
import type { DeleteCollectionMutationType } from '@/components/target/laboratory/delete-collection-modal';
import type { DeleteOperationMutationType } from '@/components/target/laboratory/delete-operation-modal';
import type {
  CDNAccessTokenCreateMutation,
  CDNAccessTokenDeleteMutation,
} from '@/components/target/settings/cdn-access-tokens';
import type { CreateAccessToken_CreateTokenMutation } from '@/components/target/settings/registry-access-token';
import { graphql } from '@/gql';
import schema from '@/gql/schema';
import { CollectionsQuery } from '@/lib/hooks/laboratory/use-collections';
import type { JoinOrganizationPage_JoinOrganizationMutation } from '@/pages/organization-join';
import type { CreateOrganizationMutation } from '@/pages/organization-new';
import type { DeleteOrganizationDocument } from '@/pages/organization-settings';
import type { DeleteProjectMutation } from '@/pages/project-settings';
import type { ApproveFailedSchemaCheckMutation } from '@/pages/target-checks-single';
import {
  ManageFilters_SavedFiltersQuery,
  type ManageFilters_DeleteSavedFilterMutation,
} from '@/pages/target-insights-manage-filters';
import {
  TokensDocument,
  type DeleteTargetMutation,
  type DeleteTokensDocument,
} from '@/pages/target-settings';
import { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';
import {
  Cache,
  CacheExchangeOpts,
  OptimisticMutationResolver,
  QueryInput,
  UpdateResolver,
} from '@urql/exchange-graphcache';
import { relayPagination } from '@urql/exchange-graphcache/extras';

const TargetsDocument = graphql(`
  query targets($selector: ProjectSelectorInput!) {
    targets(selector: $selector) {
      edges {
        node {
          id
        }
      }
    }
  }
`);

const getOperationName = (query: DocumentNode): string | void => {
  for (const node of query.definitions) {
    if (node.kind === Kind.OPERATION_DEFINITION) {
      return node.name?.value;
    }
  }
};

function updateQuery<T, V>(cache: Cache, input: QueryInput<T, V>, recipe: (obj: T) => void) {
  return cache.updateQuery(input, (data: T | null) => {
    if (!data) {
      console.error('Query Cache Updater: Empty data', {
        operationName: getOperationName(input.query as TypedDocumentNode),
        variables: input.variables,
      });
      return null;
    }
    return produce(data, recipe);
  });
}

type TypedDocumentNodeUpdateResolver<TNode extends TypedDocumentNode<any, any>> = UpdateResolver<
  ResultOf<TNode>,
  VariablesOf<TNode>
>;

const deleteAlerts: TypedDocumentNodeUpdateResolver<
  typeof DeleteAlertsButton_DeleteAlertsMutation
> = ({ deleteAlerts }, _args, cache) => {
  if (deleteAlerts.ok) {
    cache.invalidate({
      __typename: 'Project',
      id: deleteAlerts.ok.updatedProject.id,
    });
  }
};

const createOrganization: TypedDocumentNodeUpdateResolver<typeof CreateOrganizationMutation> = (
  _data,
  _args,
  cache,
) => {
  cache.invalidate('Query', 'organizations');
};

// The viewer's organizations are one session-level document; a join has to reach it.
const joinOrganization: TypedDocumentNodeUpdateResolver<
  typeof JoinOrganizationPage_JoinOrganizationMutation
> = ({ joinOrganization }, _args, cache) => {
  if (joinOrganization.__typename === 'OrganizationPayload') {
    cache.invalidate('Query', 'organizations');
  }
};

// The removed member may be the viewer; one viewer refetch after a rare action beats a cache lookup.
const deleteOrganizationMember: TypedDocumentNodeUpdateResolver<
  typeof OrganizationMemberRow_DeleteMember
> = (_data, _args, cache) => {
  cache.invalidate('Query', 'organizations');
};

const deleteOrganization: TypedDocumentNodeUpdateResolver<typeof DeleteOrganizationDocument> = (
  { deleteOrganization },
  _args,
  cache,
) => {
  const { organization } = deleteOrganization;

  cache.invalidate({
    __typename: organization.__typename,
    id: organization.id,
  });
};

const createProject: TypedDocumentNodeUpdateResolver<typeof CreateProjectMutation> = (
  { createProject },
  _args,
  cache,
) => {
  if (!createProject.ok) {
    return;
  }

  cache.invalidate({
    __typename: 'Organization',
    id: createProject.ok.updatedOrganization.id,
  });
};

const deleteProject: TypedDocumentNodeUpdateResolver<typeof DeleteProjectMutation> = (
  { deleteProject },
  _args,
  cache,
) => {
  const projectId = deleteProject.ok?.deletedProjectId;

  if (projectId) {
    cache.invalidate({
      __typename: 'Project',
      id: projectId,
    });
  }
};

const createTarget: TypedDocumentNodeUpdateResolver<typeof CreateTarget_CreateTargetMutation> = (
  { createTarget },
  _args,
  cache,
) => {
  if (!createTarget.ok) {
    return;
  }

  const target = createTarget.ok.createdTarget;
  const { selector } = createTarget.ok;

  // The selector tree reads Project.targets, which the patch below misses.
  cache.invalidate({ __typename: 'Project', id: target.project.id }, 'targets');

  updateQuery(
    cache,
    {
      query: TargetsDocument,
      variables: {
        selector: {
          organizationSlug: selector.organizationSlug,
          projectSlug: selector.projectSlug,
        },
      },
    },
    data => {
      // TODO: figure out masking
      data.targets.edges.unshift({ node: target as any, cursor: '' } as any);
    },
  );
};

const deleteTarget: TypedDocumentNodeUpdateResolver<typeof DeleteTargetMutation> = (
  { deleteTarget },
  _args,
  cache,
) => {
  const targetId = deleteTarget.ok?.deletedTargetId;

  if (targetId) {
    cache.invalidate({
      __typename: 'Target',
      id: targetId,
    });
  }
};

const createToken: TypedDocumentNodeUpdateResolver<typeof CreateAccessToken_CreateTokenMutation> = (
  { createToken },
  _args,
  cache,
) => {
  if (!createToken.ok) {
    return;
  }
  const { selector, createdToken } = createToken.ok;

  updateQuery(
    cache,
    {
      query: TokensDocument,
      variables: {
        selector: {
          organizationSlug: selector.organizationSlug,
          projectSlug: selector.projectSlug,
          targetSlug: selector.targetSlug,
        },
      },
    },
    data => {
      data.tokens.nodes.unshift(createdToken as any);
      data.tokens.total += 1;
    },
  );
};

const deleteTokens: TypedDocumentNodeUpdateResolver<typeof DeleteTokensDocument> = (
  { deleteTokens },
  _args,
  cache,
) => {
  const { selector } = deleteTokens;

  updateQuery(
    cache,
    {
      query: TokensDocument,
      variables: {
        selector: {
          organizationSlug: selector.organizationSlug,
          projectSlug: selector.projectSlug,
          targetSlug: selector.targetSlug,
        },
      },
    },
    data => {
      data.tokens.nodes = data.tokens.nodes.filter(
        node => !deleteTokens.deletedTokens.includes(node.id),
      );
      data.tokens.total = data.tokens.nodes.length;
    },
  );
};

const addAlertChannel: TypedDocumentNodeUpdateResolver<
  typeof CreateChannel_AddAlertChannelMutation
> = ({ addAlertChannel }, args, cache) => {
  if (!addAlertChannel.ok) {
    return;
  }

  const { updatedProject } = addAlertChannel.ok;
  cache.invalidate({
    __typename: 'Project',
    id: updatedProject.id,
  });
};
const deleteAlertChannels: TypedDocumentNodeUpdateResolver<
  typeof DeleteChannelsButton_DeleteChannelsMutation
> = ({ deleteAlertChannels }, _args, cache) => {
  if (deleteAlertChannels.ok) {
    cache.invalidate({
      __typename: 'Project',
      id: deleteAlertChannels.ok.updatedProject.id,
    });
  }
};
const addAlert: TypedDocumentNodeUpdateResolver<typeof CreateAlertModal_AddAlertMutation> = (
  { addAlert },
  _args,
  cache,
) => {
  if (!addAlert.ok) {
    return;
  }

  const { updatedProject } = addAlert.ok;
  cache.invalidate({
    __typename: 'Project',
    id: updatedProject.id,
  });
};

const deleteDocumentCollection: TypedDocumentNodeUpdateResolver<DeleteCollectionMutationType> = (
  mutation,
  args,
  cache,
) => {
  cache.updateQuery(
    {
      query: CollectionsQuery,
      variables: {
        selector: args.selector,
      },
    },
    data => {
      if (data === null) {
        return null;
      }

      return {
        ...data,
        target: Object.assign(
          {},
          data.target,
          mutation.deleteDocumentCollection.ok?.updatedTarget || {},
        ),
      };
    },
  );
};

const deleteOperationInDocumentCollection: TypedDocumentNodeUpdateResolver<
  DeleteOperationMutationType
> = (mutation, args, cache) => {
  cache.updateQuery(
    {
      query: CollectionsQuery,
      variables: {
        selector: args.selector,
      },
    },
    data => {
      if (data === null) {
        return null;
      }

      return {
        ...data,
        target: Object.assign(
          {},
          data.target,
          mutation.deleteOperationInDocumentCollection.ok?.updatedTarget || {},
        ),
      };
    },
  );
};

const createOperationInDocumentCollection: TypedDocumentNodeUpdateResolver<
  CreateOperationMutationType
> = (mutation, args, cache) => {
  cache.updateQuery(
    {
      query: CollectionsQuery,
      variables: {
        selector: args.selector,
      },
    },
    data => {
      if (data === null) {
        return null;
      }

      return {
        ...data,
        target: Object.assign(
          {},
          data.target,
          mutation.createOperationInDocumentCollection.ok?.updatedTarget || {},
        ),
      };
    },
  );
};

const deleteSavedFilter: TypedDocumentNodeUpdateResolver<
  typeof ManageFilters_DeleteSavedFilterMutation
> = ({ deleteSavedFilter }, args, cache) => {
  if (!deleteSavedFilter.ok) {
    return;
  }

  const selector = args.input.target.bySelector;
  if (!selector) {
    return;
  }

  updateQuery(
    cache,
    {
      query: ManageFilters_SavedFiltersQuery,
      variables: {
        organizationSlug: selector.organizationSlug,
        selector: {
          organizationSlug: selector.organizationSlug,
          projectSlug: selector.projectSlug,
          targetSlug: selector.targetSlug,
        },
      },
    },
    data => {
      if (data.target) {
        data.target.savedFilters.edges = data.target.savedFilters.edges.filter(
          edge => edge.node.id !== deleteSavedFilter.ok!.deletedId,
        );
      }
    },
  );
};

/**
 * Drops every cached page of `Target.cdnAccessTokens` for the target the mutation named, so the
 * open page refetches; the pages are keyed by cursor, so a written result could not reach them.
 */
function invalidateCdnAccessTokens(
  cache: Cache,
  selector: { organizationSlug: string; projectSlug: string; targetSlug: string },
) {
  const target = cache.resolve('Query', 'target', { reference: { bySelector: selector } });
  if (typeof target !== 'string') {
    return;
  }
  for (const field of cache.inspectFields(target)) {
    if (field.fieldName === 'cdnAccessTokens') {
      cache.invalidate(target, field.fieldName, field.arguments ?? undefined);
    }
  }
}

const createCdnAccessToken: TypedDocumentNodeUpdateResolver<typeof CDNAccessTokenCreateMutation> = (
  { createCdnAccessToken },
  args,
  cache,
) => {
  const selector = args.input.target.bySelector;
  if (createCdnAccessToken.ok && selector) {
    invalidateCdnAccessTokens(cache, selector);
  }
};

const deleteCdnAccessToken: TypedDocumentNodeUpdateResolver<typeof CDNAccessTokenDeleteMutation> = (
  { deleteCdnAccessToken },
  args,
  cache,
) => {
  const selector = args.input.target.bySelector;
  if (deleteCdnAccessToken.ok && selector) {
    invalidateCdnAccessTokens(cache, selector);
  }
};

const addMetricAlertRule: TypedDocumentNodeUpdateResolver<
  typeof AlertForm_AddMetricAlertRuleMutation
> = ({ addMetricAlertRule }, _args, cache) => {
  if (!addMetricAlertRule.ok) return;
  cache.invalidate({
    __typename: 'Target',
    id: addMetricAlertRule.ok.updatedTarget.id,
  });
};

// UpdateResolver
const approveFailedSchemaCheck: TypedDocumentNodeUpdateResolver<
  typeof ApproveFailedSchemaCheckMutation
> = ({ approveFailedSchemaCheck }, _args, cache) => {
  const check = approveFailedSchemaCheck.ok?.schemaCheck;
  if (!check) {
    return;
  }
  // The result rewrites the first page of breaking changes; later pages are read again on demand.
  const keys = [
    cache.keyOfEntity({ __typename: check.__typename, id: check.id }),
    ...(check.contractChecks?.edges.map(edge =>
      cache.keyOfEntity({ __typename: 'ContractCheck', id: edge.node.id }),
    ) ?? []),
  ];
  for (const key of keys) {
    for (const field of key ? cache.inspectFields(key) : []) {
      if (field.fieldName === 'breakingSchemaChanges' && field.arguments?.offset) {
        cache.invalidate(key, field.fieldName, field.arguments);
      }
    }
  }
};

export const Mutation = {
  createOrganization,
  joinOrganization,
  deleteOrganizationMember,
  deleteOrganization,
  createProject,
  deleteProject,
  createTarget,
  deleteTarget,
  createToken,
  deleteTokens,
  deleteAlerts,
  addAlertChannel,
  deleteAlertChannels,
  addAlert,
  deleteDocumentCollection,
  deleteOperationInDocumentCollection,
  createOperationInDocumentCollection,
  deleteSavedFilter,
  createCdnAccessToken,
  deleteCdnAccessToken,
  addMetricAlertRule,
  approveFailedSchemaCheck,
};

const updateMetricAlertRuleOptimistic: OptimisticMutationResolver = args => {
  const input = (args as { input?: Record<string, unknown> }).input;
  const ruleId = input?.ruleId as string | undefined;
  if (!input || !ruleId) return null;
  // Only the dedicated enable/disable toggle is safe to flip optimistically
  const isEnabledOnlyToggle = Object.keys(input).every(
    key => key === 'project' || key === 'ruleId' || key === 'enabled',
  );
  if (!isEnabledOnlyToggle) return null;
  return {
    __typename: 'UpdateMetricAlertRuleResult',
    error: null,
    ok: {
      __typename: 'UpdateMetricAlertRuleOk',
      updatedMetricAlertRule: {
        __typename: 'MetricAlertRule',
        id: ruleId,
        enabled: input.enabled as boolean,
        updatedAt: new Date().toISOString(),
      },
    },
  };
};

export const Optimistic = {
  updateMetricAlertRule: updateMetricAlertRuleOptimistic,
};

const noKey = (): null => null;

/** The graphcache configuration: the app's client and the specs' test client both build their cache from it. */
export const cacheOptions = {
  schema,
  updates: {
    Mutation,
  },
  optimistic: Optimistic,
  resolvers: {
    Target: {
      appDeployments: relayPagination(),
      schemaChecks: relayPagination(),
      schemaVersions: relayPagination(),
      traces: relayPagination(),
    },
    AppDeployment: {
      documents: relayPagination(),
    },
    Organization: {
      accessTokens: relayPagination(),
      allAccessTokens: relayPagination(),
      groups: relayPagination(),
    },
    Project: {
      accessTokens: relayPagination(),
    },
    Member: {
      accessTokens: relayPagination(),
    },
  },
  keys: {
    RequestsOverTime: noKey,
    FailuresOverTime: noKey,
    DurationOverTime: noKey,
    SchemaCoordinateStats: noKey,
    ErrorStatsValues: noKey,
    ErrorCodesOverTime: noKey,
    ClientStats: noKey,
    ClientStatsValues: noKey,
    ClientVersionStatsValues: noKey,
    InsightsDateRange: noKey,
    OperationsStats: noKey,
    OperationStatsValues: noKey,
    DurationValues: noKey,
    OrganizationPayload: noKey,
    SchemaChange: noKey,
    SchemaChangeGroup: noKey,
    SchemaChangeUsageStatisticsAffectedTarget: noKey,
    GitHubIntegration: noKey,
    GitHubRepository: noKey,
    SchemaExplorer: noKey,
    UnusedSchemaExplorer: noKey,
    OrganizationGetStarted: noKey,
    GraphQLObjectType: noKey,
    GraphQLInterfaceType: noKey,
    GraphQLUnionType: noKey,
    GraphQLEnumType: noKey,
    GraphQLInputObjectType: noKey,
    GraphQLScalarType: noKey,
    GraphQLField: noKey,
    GraphQLInputField: noKey,
    GraphQLArgument: noKey,
    SchemaCoordinateUsage: noKey,
    SuccessfulSchemaCheck: ({ id }) => `SchemaCheck:${id}`,
    FailedSchemaCheck: ({ id }) => `SchemaCheck:${id}`,
    SchemaChangeApproval: ({ schemaCheckId }) => `SchemaChangeApproval:${schemaCheckId}`,
    SchemaMetadata: noKey,
    SupergraphMetadata: noKey,
    MetadataAttribute: noKey,
    RateLimit: noKey,
    DeprecatedSchemaExplorer: noKey,
    TraceStatusBreakdownBucket: noKey,
    FilterStringOption: noKey,
    FilterBooleanOption: noKey,
    TracesFilterOptions: noKey,
    ResourceAssignment: noKey,
    TargetServicesResourceAssignment: noKey,
    TargetAppDeploymentsResourceAssignment: noKey,
    TargetResouceAssignment: noKey,
    ProjectTargetsResourceAssignment: noKey,
    ProjectResourceAssignment: noKey,
    BillingConfiguration: noKey,
    InsightsFilterConfiguration: noKey,
    ClientFilter: noKey,
    SchemaChangeMeta: noKey,
    SchemaCheckMeta: noKey,
    SchemaVersionMeta: noKey,
    SchemaVersionGithubMetadata: noKey,
    SchemaVersionPromoteOrigin: noKey,
    SchemaVersionPublishOrigin: noKey,
    SchemaVersionSubgraphRemoveOrigin: noKey,
    SubgraphOriginSubgraphReference: noKey,
    FieldArgumentDescriptionChanged: noKey,
    FieldArgumentTypeChanged: noKey,
    DirectiveRemoved: noKey,
    DirectiveAdded: noKey,
    DirectiveDescriptionChanged: noKey,
    DirectiveLocationAdded: noKey,
    DirectiveLocationRemoved: noKey,
    DirectiveArgumentAdded: noKey,
    DirectiveArgumentRemoved: noKey,
    DirectiveArgumentDescriptionChanged: noKey,
    DirectiveArgumentDefaultValueChanged: noKey,
    DirectiveArgumentTypeChanged: noKey,
    EnumValueRemoved: noKey,
    EnumValueAdded: noKey,
    EnumValueDescriptionChanged: noKey,
    EnumValueDeprecationReasonChanged: noKey,
    EnumValueDeprecationReasonAdded: noKey,
    EnumValueDeprecationReasonRemoved: noKey,
    FieldRemoved: noKey,
    FieldAdded: noKey,
    FieldDescriptionChanged: noKey,
    FieldDescriptionAdded: noKey,
    FieldDescriptionRemoved: noKey,
    FieldDeprecationAdded: noKey,
    FieldDeprecationRemoved: noKey,
    FieldDeprecationReasonChanged: noKey,
    FieldDeprecationReasonAdded: noKey,
    FieldDeprecationReasonRemoved: noKey,
    FieldTypeChanged: noKey,
    DirectiveUsageUnionMemberAdded: noKey,
    DirectiveUsageUnionMemberRemoved: noKey,
    FieldArgumentAdded: noKey,
    FieldArgumentRemoved: noKey,
    InputFieldRemoved: noKey,
    InputFieldAdded: noKey,
    InputFieldDescriptionAdded: noKey,
    InputFieldDescriptionRemoved: noKey,
    InputFieldDescriptionChanged: noKey,
    InputFieldDefaultValueChanged: noKey,
    InputFieldTypeChanged: noKey,
    ObjectTypeInterfaceAdded: noKey,
    ObjectTypeInterfaceRemoved: noKey,
    SchemaQueryTypeChanged: noKey,
    SchemaMutationTypeChanged: noKey,
    SchemaSubscriptionTypeChanged: noKey,
    TypeRemoved: noKey,
    TypeAdded: noKey,
    TypeKindChanged: noKey,
    TypeDescriptionChanged: noKey,
    TypeDescriptionAdded: noKey,
    TypeDescriptionRemoved: noKey,
    UnionMemberRemoved: noKey,
    UnionMemberAdded: noKey,
    DirectiveUsageEnumAdded: noKey,
    DirectiveUsageEnumRemoved: noKey,
    DirectiveUsageEnumValueAdded: noKey,
    DirectiveUsageEnumValueRemoved: noKey,
    DirectiveUsageInputObjectRemoved: noKey,
    DirectiveUsageInputObjectAdded: noKey,
    DirectiveUsageInputFieldDefinitionAdded: noKey,
    DirectiveUsageInputFieldDefinitionRemoved: noKey,
    DirectiveUsageFieldAdded: noKey,
    DirectiveUsageFieldRemoved: noKey,
    DirectiveUsageScalarAdded: noKey,
    DirectiveUsageScalarRemoved: noKey,
    DirectiveUsageObjectAdded: noKey,
    DirectiveUsageObjectRemoved: noKey,
    DirectiveUsageInterfaceAdded: noKey,
    DirectiveUsageSchemaAdded: noKey,
    DirectiveUsageSchemaRemoved: noKey,
    DirectiveUsageFieldDefinitionAdded: noKey,
    DirectiveUsageFieldDefinitionRemoved: noKey,
    DirectiveUsageArgumentDefinitionRemoved: noKey,
    DirectiveUsageInterfaceRemoved: noKey,
    DirectiveUsageArgumentDefinitionAdded: noKey,
    DirectiveUsageArgumentAdded: noKey,
    DirectiveUsageArgumentRemoved: noKey,
    DirectiveRepeatableAdded: noKey,
    DirectiveRepeatableRemoved: noKey,
    SchemaCompositionResult: noKey,
    NativeCompositionVersionStatus: noKey,
    NativeCompositionCompatibility: noKey,
  },
  globalIDs: ['SuccessfulSchemaCheck', 'FailedSchemaCheck'],
} satisfies Partial<CacheExchangeOpts>;
