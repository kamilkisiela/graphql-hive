import colors from 'colors';
import { graphql } from '../gql';
import { createCommand } from '../helpers/command';
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

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'whoami',
    'shows information about the current token',
    y =>
      y
        .option('registry.endpoint', {
          type: 'string',
          description: 'registry endpoint',
        })
        .option('registry.accessToken', {
          type: 'string',
          description: 'registry access token',
        })
        .option('registry', {
          type: 'string',
          description: 'registry address',
          deprecated: 'use --registry.endpoint',
        })
        .option('token', {
          type: 'string',
          description: 'api token',
          deprecated: 'use --registry.accessToken',
        }),
    async args => {
      const registry = ctx.ensure({
        key: 'registry.endpoint',
        legacyFlagName: 'registry',
        args,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const token = ctx.ensure({
        key: 'registry.accessToken',
        legacyFlagName: 'token',
        args,
        env: 'HIVE_TOKEN',
      });

      const result = await ctx
        .graphql(registry, token)
        .request(myTokenInfoQuery)
        .catch(error => {
          return ctx.handleFetchError(error);
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

        ctx.logger.log(print());
      } else if (result.tokenInfo.__typename === 'TokenNotFoundError') {
        ctx.exit('failure', {
          message: `Token not found. Reason: ${result.tokenInfo.message}`,
          suggestion: `How to create a token? https://docs.graphql-hive.com/features/tokens`,
        });
      }
    },
  );
});

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
