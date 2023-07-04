import colors from 'colors';
import { Flags } from '@oclif/core';
import Command from '../base-command';
import { graphql } from '../gql';
import { graphqlEndpoint } from '../helpers/config';

const myTokenInfoQuery = graphql(/* GraphQL */ `
  query myTokenInfo {
    tokenInfo {
      __typename
      ... on TokenInfo {
        token {
          name
        }
        organization {
          name
          cleanId
        }
        project {
          name
          type
          cleanId
        }
        target {
          name
          cleanId
        }
        canPublishSchema: hasTargetScope(scope: REGISTRY_WRITE)
        canCheckSchema: hasTargetScope(scope: REGISTRY_READ)
        canPublishOperations: hasProjectScope(scope: OPERATIONS_STORE_WRITE)
      }
      ... on TokenNotFoundError {
        message
      }
    }
  }
`);

export default class WhoAmI extends Command {
  static description = 'shows information about the current token';
  static flags = {
    'registry.endpoint': Flags.string({
      description: 'registry endpoint',
    }),
    /** @deprecated */
    registry: Flags.string({
      description: 'registry address',
      deprecated: {
        message: 'use --registry.endpoint instead',
        version: '0.21.0',
      },
    }),
    'registry.accessToken': Flags.string({
      description: 'registry access token',
    }),
    /** @deprecated */
    token: Flags.string({
      description: 'api token',
      deprecated: {
        message: 'use --registry.accessToken instead',
        version: '0.21.0',
      },
    }),
  };

  async run() {
    const { flags } = await this.parse(WhoAmI);

    const registry = this.ensure({
      key: 'registry.endpoint',
      legacyFlagName: 'registry',
      args: flags,
      defaultValue: graphqlEndpoint,
      env: 'HIVE_REGISTRY',
    });
    const token = this.ensure({
      key: 'registry.accessToken',
      legacyFlagName: 'token',
      args: flags,
      env: 'HIVE_TOKEN',
    });

    const result = await this.registryApi(registry, token)
      .request(myTokenInfoQuery)
      .catch(error => {
        this.handleFetchError(error);
      });

    if (result.tokenInfo.__typename === 'TokenInfo') {
      const { tokenInfo } = result;
      const { organization, project, target } = tokenInfo;

      const organizationUrl = `https://app.graphql-hive.com/${organization.cleanId}`;
      const projectUrl = `${organizationUrl}/${project.cleanId}`;
      const targetUrl = `${projectUrl}/${target.cleanId}`;

      const access = {
        yes: colors.green('Yes'),
        not: colors.red('No access'),
      };

      const print = createPrinter({
        'Token name:': [colors.bold(tokenInfo.token.name)],
        ' ': [''],
        'Organization:': [colors.bold(organization.name), colors.dim(organizationUrl)],
        'Project:': [colors.bold(project.name), colors.dim(projectUrl)],
        'Target:': [colors.bold(target.name), colors.dim(targetUrl)],
        '  ': [''],
        'Access to schema:publish': [tokenInfo.canPublishSchema ? access.yes : access.not],
        'Access to schema:check': [tokenInfo.canCheckSchema ? access.yes : access.not],
        'Access to operation:publish': [tokenInfo.canPublishOperations ? access.yes : access.not],
      });

      this.log(print());
    } else if (result.tokenInfo.__typename === 'TokenNotFoundError') {
      this.error(`Token not found. Reason: ${result.tokenInfo.message}`, {
        exit: 0,
        suggestions: [`How to create a token? https://docs.graphql-hive.com/features/tokens`],
      });
    }
  }
}

function createPrinter(records: { [label: string]: [value: string, extra?: string] }) {
  const labels = Object.keys(records);
  const values = Object.values(records).map(v => v[0]);
  const maxLabelsLen = Math.max(...labels.map(v => v.length)) + 4;
  const maxValuesLen = Math.max(...values.map(v => v.length)) + 4;

  return () => {
    const lines: string[] = [];

    for (const label in records) {
      const [value, extra] = records[label];

      lines.push(label.padEnd(maxLabelsLen, ' ') + value.padEnd(maxValuesLen, ' ') + (extra || ''));
    }

    return lines.join('\n');
  };
}
