import { buildSchema, GraphQLError, Source } from 'graphql';
import { InvalidDocument, validate } from '@graphql-inspector/core';
import { graphql } from '../../gql';
import { Context, createCommand } from '../../helpers/command';
import { graphqlEndpoint } from '../../helpers/config';
import { loadOperations } from '../../helpers/operations';

const fetchLatestVersionQuery = graphql(/* GraphQL */ `
  query fetchLatestVersion {
    latestValidVersion {
      sdl
    }
  }
`);

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'operations:check <file>',
    'Checks operations against a published schema',
    y =>
      y
        .positional('file', {
          describe: 'Glob pattern to find the operations',
          demandOption: true,
          type: 'string',
        })
        .option('require', {
          type: 'string',
          array: true,
          description:
            'Loads specific require.extensions before running the codegen and reading the configuration',
          default: [],
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
      await ctx.require(args.require);
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
      const file: string = args.file;

      const operations = await loadOperations(file, {
        normalize: false,
      });

      if (operations.length === 0) {
        ctx.logger.info('No operations found');
        ctx.exit('success');
        return;
      }

      const result = await ctx
        .graphql(endpoint, accessToken)
        .request(fetchLatestVersionQuery)
        .catch(error => {
          return ctx.handleFetchError(error);
        });

      const sdl = result.latestValidVersion?.sdl;

      if (!sdl) {
        return ctx.exit('failure', {
          message: 'Could not find a published schema. Please publish a valid schema first.',
        });
      }

      const schema = buildSchema(sdl, {
        assumeValidSDL: true,
        assumeValid: true,
      });

      const invalidOperations = validate(
        schema,
        operations.map(s => new Source(s.content, s.location)),
      );

      if (invalidOperations.length === 0) {
        ctx.logger.success('All operations are valid');
        ctx.exit('success');
        return;
      }

      ctx.logger.fail('Some operations are invalid');

      ctx.logger.log(
        ['', `Total: ${operations.length}`, `Invalid: ${invalidOperations.length}`, ''].join('\n'),
      );

      printInvalidDocuments(invalidOperations, 'errors', ctx);
    },
  );
});

function printInvalidDocuments(
  invalidDocuments: InvalidDocument[],
  listKey: 'errors' | 'deprecated',
  ctx: Context,
): void {
  invalidDocuments.forEach(doc => {
    if (doc.errors.length) {
      renderErrors(doc.source.name, doc[listKey], ctx).forEach(line => {
        ctx.logger.log(line);
      });
    }
  });
}

function renderErrors(sourceName: string, errors: GraphQLError[], ctx: Context): string[] {
  const errorsAsString = errors.map(e => ` - ${ctx.bolderize(e.message)}`).join('\n');

  return [`ERROR in ${sourceName}:\n`, errorsAsString, '\n\n'];
}
