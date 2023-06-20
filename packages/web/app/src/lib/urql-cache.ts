/* eslint-disable import/no-extraneous-dependencies */
import { DocumentNode, Kind } from 'graphql';
import { produce } from 'immer';
import { TypedDocumentNode } from 'urql';
import type { CreateAlertModal_AddAlertMutation } from '@/components/project/alerts/create-alert';
import type { CreateChannel_AddAlertChannelMutation } from '@/components/project/alerts/create-channel';
import type { DeleteAlertsButton_DeleteAlertsMutation } from '@/components/project/alerts/delete-alerts-button';
import type { DeleteChannelsButton_DeleteChannelsMutation } from '@/components/project/alerts/delete-channels-button';
import type { CreateOperationMutationType } from '@/components/v2/modals/create-operation';
import type { CreateProjectMutation } from '@/components/v2/modals/create-project';
import type { DeleteCollectionMutationType } from '@/components/v2/modals/delete-collection';
import type { DeleteOperationMutationType } from '@/components/v2/modals/delete-operation';
import { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';
import { Cache, QueryInput, UpdateResolver } from '@urql/exchange-graphcache';
import {
  CheckIntegrationsDocument,
  CreateOrganizationDocument,
  CreateTargetDocument,
  CreateTokenDocument,
  DeleteGitHubIntegrationDocument,
  DeleteOrganizationDocument,
  DeletePersistedOperationDocument,
  DeleteProjectDocument,
  DeleteSlackIntegrationDocument,
  DeleteTargetDocument,
  DeleteTokensDocument,
  OrganizationsDocument,
  TargetsDocument,
  TokensDocument,
} from '../graphql';
import { CollectionsQuery } from './hooks/use-collections';

export const getOperationName = (query: DocumentNode): string | void => {
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

const createOrganization: TypedDocumentNodeUpdateResolver<typeof CreateOrganizationDocument> = (
  { createOrganization },
  _args,
  cache,
) => {
  updateQuery(
    cache,
    {
      query: OrganizationsDocument,
    },
    data => {
      if (createOrganization.ok) {
        data.organizations.nodes.unshift(
          createOrganization.ok.createdOrganizationPayload.organization,
        );
        data.organizations.total += 1;
      }
    },
  );
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

const deleteProject: TypedDocumentNodeUpdateResolver<typeof DeleteProjectDocument> = (
  { deleteProject },
  _args,
  cache,
) => {
  const project = deleteProject.deletedProject;

  cache.invalidate({
    __typename: project.__typename,
    id: project.id,
  });
};

const createTarget: TypedDocumentNodeUpdateResolver<typeof CreateTargetDocument> = (
  { createTarget },
  _args,
  cache,
) => {
  if (!createTarget.ok) {
    return;
  }

  const target = createTarget.ok.createdTarget;
  const { selector } = createTarget.ok;

  updateQuery(
    cache,
    {
      query: TargetsDocument,
      variables: {
        selector: {
          organization: selector.organization,
          project: selector.project,
        },
      },
    },
    data => {
      data.targets.nodes.unshift(target);
      data.targets.total += 1;
    },
  );
};

const deleteTarget: TypedDocumentNodeUpdateResolver<typeof DeleteTargetDocument> = (
  { deleteTarget },
  _args,
  cache,
) => {
  const target = deleteTarget.deletedTarget;

  cache.invalidate({
    __typename: target.__typename,
    id: target.id,
  });
};

const createToken: TypedDocumentNodeUpdateResolver<typeof CreateTokenDocument> = (
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
          organization: selector.organization,
          project: selector.project,
          target: selector.target,
        },
      },
    },
    data => {
      data.tokens.nodes.unshift(createdToken);
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
          organization: selector.organization,
          project: selector.project,
          target: selector.target,
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
const deletePersistedOperation: TypedDocumentNodeUpdateResolver<
  typeof DeletePersistedOperationDocument
> = ({ deletePersistedOperation }, _args, cache) => {
  const operation = deletePersistedOperation.deletedPersistedOperation;

  cache.invalidate({
    __typename: operation.__typename,
    id: operation.id,
  });
};
const deleteSlackIntegration: TypedDocumentNodeUpdateResolver<
  typeof DeleteSlackIntegrationDocument
> = (_, args, cache) => {
  cache.updateQuery(
    {
      query: CheckIntegrationsDocument,
      variables: {
        selector: {
          organization: args.input.organization,
        },
      },
    },
    data => {
      if (data === null) {
        return null;
      }
      return {
        ...data,
        hasSlackIntegration: false,
      };
    },
  );
};
const deleteGitHubIntegration: TypedDocumentNodeUpdateResolver<
  typeof DeleteGitHubIntegrationDocument
> = (_, args, cache) => {
  cache.updateQuery(
    {
      query: CheckIntegrationsDocument,
      variables: {
        selector: {
          organization: args.input.organization,
        },
      },
    },
    data => {
      if (data === null) {
        return null;
      }
      return {
        ...data,
        hasGitHubIntegration: false,
      };
    },
  );
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

// UpdateResolver
export const Mutation = {
  createOrganization,
  deleteOrganization,
  createProject,
  deleteProject,
  createTarget,
  deleteTarget,
  createToken,
  deleteTokens,
  deleteAlerts,
  deleteGitHubIntegration,
  deleteSlackIntegration,
  addAlertChannel,
  deleteAlertChannels,
  addAlert,
  deletePersistedOperation,
  deleteDocumentCollection,
  deleteOperationInDocumentCollection,
  createOperationInDocumentCollection,
};
