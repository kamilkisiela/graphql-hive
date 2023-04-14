/* eslint-disable import/no-extraneous-dependencies */
import produce from 'immer';
import { getOperationName, TypedDocumentNode } from 'urql';
import { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';
import { Cache, QueryInput, UpdateResolver } from '@urql/exchange-graphcache';
import {
  AddAlertChannelDocument,
  AddAlertDocument,
  AlertChannelsDocument,
  AlertsDocument,
  CheckIntegrationsDocument,
  CreateOrganizationDocument,
  CreateProjectDocument,
  CreateTargetDocument,
  CreateTokenDocument,
  DeleteAlertChannelsDocument,
  DeleteAlertsDocument,
  DeleteGitHubIntegrationDocument,
  DeleteOrganizationDocument,
  DeletePersistedOperationDocument,
  DeleteProjectDocument,
  DeleteSlackIntegrationDocument,
  DeleteTargetDocument,
  DeleteTokensDocument,
  OrganizationsDocument,
  ProjectsDocument,
  TargetsDocument,
  TokensDocument,
} from '../graphql';

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

const deleteAlerts: TypedDocumentNodeUpdateResolver<typeof DeleteAlertsDocument> = (
  { deleteAlerts },
  _args,
  cache,
) => {
  for (const alert of deleteAlerts) {
    cache.invalidate({
      __typename: alert.__typename,
      id: alert.id,
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

const createProject: TypedDocumentNodeUpdateResolver<typeof CreateProjectDocument> = (
  { createProject },
  _args,
  cache,
) => {
  if (!createProject.ok) {
    return;
  }
  const { selector } = createProject.ok;
  const project = createProject.ok.createdProject;

  updateQuery(
    cache,
    {
      query: ProjectsDocument,
      variables: {
        selector: {
          organization: selector.organization,
        },
      },
    },
    data => {
      data.projects.nodes.unshift(project);
      data.projects.total += 1;
    },
  );
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

const addAlertChannel: TypedDocumentNodeUpdateResolver<typeof AddAlertChannelDocument> = (
  { addAlertChannel },
  args,
  cache,
) => {
  if (!addAlertChannel.ok) {
    return;
  }

  const { addedAlertChannel } = addAlertChannel.ok;

  updateQuery(
    cache,
    {
      query: AlertChannelsDocument,
      variables: {
        selector: {
          organization: args.input.organization,
          project: args.input.project,
        },
      },
    },
    data => {
      data.alertChannels.unshift(addedAlertChannel);
    },
  );
};
const deleteAlertChannels: TypedDocumentNodeUpdateResolver<typeof DeleteAlertChannelsDocument> = (
  { deleteAlertChannels },
  _args,
  cache,
) => {
  for (const channel of deleteAlertChannels) {
    cache.invalidate({
      __typename: channel.__typename,
      id: channel.id,
    });
  }
};
const addAlert: TypedDocumentNodeUpdateResolver<typeof AddAlertDocument> = (
  { addAlert },
  args,
  cache,
) => {
  updateQuery(
    cache,
    {
      query: AlertsDocument,
      variables: {
        selector: {
          organization: args.input.organization,
          project: args.input.project,
        },
      },
    },
    data => {
      data.alerts.unshift(addAlert);
    },
  );
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
};
