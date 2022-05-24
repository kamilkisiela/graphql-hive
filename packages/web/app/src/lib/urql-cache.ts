import { getOperationName, TypedDocumentNode } from 'urql';
import { Cache, ResolveInfo, UpdateResolver, QueryInput } from '@urql/exchange-graphcache';
import produce from 'immer';
import {
  TokensDocument,
  OrganizationsDocument,
  ProjectsDocument,
  TargetsDocument,
  CheckIntegrationsDocument,
  CreateTokenDocument,
  AlertChannelsDocument,
  AddAlertChannelDocument,
  DeleteAlertChannelsDocument,
  AlertsDocument,
  AddAlertDocument,
  DeleteAlertsDocument,
  DeleteTokensDocument,
  CreateOrganizationDocument,
  DeleteOrganizationDocument,
  CreateProjectDocument,
  DeleteProjectDocument,
  CreateTargetDocument,
  DeleteTargetDocument,
  DeletePersistedOperationDocument,
  DeleteSlackIntegrationDocument,
  DeleteGitHubIntegrationDocument,
} from '../graphql';

function updateQuery<T, V>(cache: Cache, input: QueryInput<T, V>, recipe: (obj: T) => void) {
  return cache.updateQuery(input, (data: T) => {
    if (!data) {
      console.error('Query Cache Updater: Empty data', {
        operationName: getOperationName(input.query as TypedDocumentNode),
        variables: input.variables,
      });
    } else {
      return produce(data, recipe);
    }
  });
}

type MutationUpdaters<
  T extends {
    [key: string]: TypedDocumentNode;
  }
> = {
  [K in keyof T]: Updater<T[K]>;
};

type Updater<TDocument extends TypedDocumentNode> = TDocument extends TypedDocumentNode<infer R, infer V>
  ? (result: R, args: V, cache: Cache, info: ResolveInfo) => void
  : UpdateResolver;

export const Mutation: MutationUpdaters<{
  createOrganization: typeof CreateOrganizationDocument;
  deleteOrganization: typeof DeleteOrganizationDocument;
  createProject: typeof CreateProjectDocument;
  deleteProject: typeof DeleteProjectDocument;
  createTarget: typeof CreateTargetDocument;
  deleteTarget: typeof DeleteTargetDocument;
  createToken: typeof CreateTokenDocument;
  deleteTokens: typeof DeleteTokensDocument;
  deletePersistedOperation: typeof DeletePersistedOperationDocument;
  deleteSlackIntegration: typeof DeleteSlackIntegrationDocument;
  deleteGitHubIntegration: typeof DeleteGitHubIntegrationDocument;
  addAlertChannel: typeof AddAlertChannelDocument;
  deleteAlertChannels: typeof DeleteAlertChannelsDocument;
  addAlert: typeof AddAlertDocument;
  deleteAlerts: typeof DeleteAlertsDocument;
}> = {
  createOrganization({ createOrganization }, _args, cache) {
    updateQuery(
      cache,
      {
        query: OrganizationsDocument,
      },
      data => {
        if (createOrganization.ok) {
          data.organizations.nodes.unshift(createOrganization.ok.createdOrganizationPayload.organization);
          data.organizations.total += 1;
        }
      }
    );
  },
  deleteOrganization({ deleteOrganization }, _args, cache) {
    const organization = deleteOrganization.organization;

    cache.invalidate({
      __typename: organization.__typename,
      id: organization.id,
    });
  },
  createProject({ createProject }, _args, cache) {
    if (!createProject.ok) {
      return;
    }
    const selector = createProject.ok.selector;
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
      }
    );
  },
  deleteProject({ deleteProject }, _args, cache) {
    const project = deleteProject.deletedProject;

    cache.invalidate({
      __typename: project.__typename,
      id: project.id,
    });
  },
  createTarget({ createTarget }, _args, cache) {
    if (!createTarget.ok) {
      return;
    }

    const target = createTarget.ok.createdTarget;
    const selector = createTarget.ok.selector;

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
      }
    );
  },
  deleteTarget({ deleteTarget }, _args, cache) {
    const target = deleteTarget.deletedTarget;

    cache.invalidate({
      __typename: target.__typename,
      id: target.id,
    });
  },
  createToken({ createToken }, _args, cache) {
    if (!createToken.ok) {
      return;
    }
    const selector = createToken.ok.selector;

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
        data.tokens.nodes.unshift(createToken.ok.createdToken);
        data.tokens.total += 1;
      }
    );
  },
  deleteTokens({ deleteTokens }, _args, cache) {
    const selector = deleteTokens.selector;

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
        data.tokens.nodes = data.tokens.nodes.filter(node => !deleteTokens.deletedTokens.includes(node.id));
        data.tokens.total = data.tokens.nodes.length;
      }
    );
  },
  addAlertChannel({ addAlertChannel }, args, cache) {
    if (!addAlertChannel.ok) {
      return;
    }

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
        data.alertChannels.unshift(addAlertChannel.ok.addedAlertChannel);
      }
    );
  },
  deleteAlertChannels({ deleteAlertChannels }, _args, cache) {
    deleteAlertChannels.forEach(channel => {
      cache.invalidate({
        __typename: channel.__typename,
        id: channel.id,
      });
    });
  },
  addAlert({ addAlert }, args, cache) {
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
      }
    );
  },
  deleteAlerts({ deleteAlerts }, _args, cache) {
    deleteAlerts.forEach(alert => {
      cache.invalidate({
        __typename: alert.__typename,
        id: alert.id,
      });
    });
  },
  deletePersistedOperation({ deletePersistedOperation }, _args, cache) {
    const operation = deletePersistedOperation.deletedPersistedOperation;

    cache.invalidate({
      __typename: operation.__typename,
      id: operation.id,
    });
  },
  deleteSlackIntegration(_, args, cache) {
    cache.updateQuery(
      {
        query: CheckIntegrationsDocument,
        variables: {
          selector: {
            organization: args.input.organization,
          },
        },
      },
      data => ({
        ...data,
        hasSlackIntegration: false,
      })
    );
  },
  deleteGitHubIntegration(_, args, cache) {
    cache.updateQuery(
      {
        query: CheckIntegrationsDocument,
        variables: {
          selector: {
            organization: args.input.organization,
          },
        },
      },
      data => ({
        ...data,
        hasGitHubIntegration: false,
      })
    );
  },
};
