import colors from 'colors';
import { graphql } from '../../gql';
import { createCommand } from '../../helpers/command';
import { graphqlEndpoint } from '../../helpers/config';
import { renderErrors } from '../../helpers/schema';

const schemaDeleteMutation = graphql(/* GraphQL */ `
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
`);

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'schema:delete <service>',
    'deletes a schema',
    y =>
      y
        .positional('service', {
          type: 'string',
          demandOption: true,
          description: 'name of the service',
        })
        .option('dryRun', {
          type: 'boolean',
          description: 'Does not delete the service, only reports what it would have done.',
          default: false,
        })
        .option('confirm', {
          type: 'boolean',
          description: 'Confirm deletion of the service',
          default: false,
        })
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
      const service: string = args.service;

      if (!args.confirm && !args.dryRun) {
        ctx.logger.infoWarning(`Are you sure you want to delete "${service}" from the registry?`);
        ctx.logger.log(`This action is irreversible.`);
        ctx.logger.log(
          `To confirm, run this command again with the ${colors.bold('--confirm')} flag.`,
        );
        ctx.exit('failure');
      }

      const endpoint = ctx.ensure({
        key: 'registry.endpoint',
        args,
        legacyFlagName: 'registry',
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const accessToken = ctx.ensure({
        key: 'registry.accessToken',
        args,
        legacyFlagName: 'token',
        env: 'HIVE_TOKEN',
      });

      const result = await ctx
        .graphql(endpoint, accessToken)
        .request(schemaDeleteMutation, {
          input: {
            serviceName: service,
            dryRun: args.dryRun,
          },
        })
        .catch(error => {
          return ctx.handleFetchError(error);
        });

      if (result.schemaDelete.__typename === 'SchemaDeleteSuccess') {
        ctx.logger.success(`${service} deleted`);
        return ctx.exit('success');
      }

      ctx.logger.fail(`Failed to delete ${service}`);
      const errors = result.schemaDelete.errors;

      if (errors) {
        renderErrors(ctx, errors);
        ctx.exit('failure');
      }
    },
  );
});
