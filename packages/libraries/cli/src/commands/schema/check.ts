import { graphql } from '../../gql';
import { createCommand } from '../../helpers/command';
import { graphqlEndpoint } from '../../helpers/config';
import { gitInfo } from '../../helpers/git';
import {
  loadSchema,
  minifySchema,
  renderChanges,
  renderErrors,
  renderWarnings,
} from '../../helpers/schema';
import { invariant } from '../../helpers/validation';

const schemaCheckMutation = graphql(/* GraphQL */ `
  mutation schemaCheck($input: SchemaCheckInput!, $usesGitHubApp: Boolean!) {
    schemaCheck(input: $input) {
      __typename
      ... on SchemaCheckSuccess @skip(if: $usesGitHubApp) {
        valid
        initial
        warnings {
          nodes {
            message
            source
            line
            column
          }
          total
        }
        changes {
          nodes {
            message
            criticality
          }
          total
        }
        schemaCheck {
          webUrl
        }
      }
      ... on SchemaCheckError @skip(if: $usesGitHubApp) {
        valid
        changes {
          nodes {
            message
            criticality
          }
          total
        }
        warnings {
          nodes {
            message
            source
            line
            column
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
          webUrl
        }
      }
      ... on GitHubSchemaCheckSuccess @include(if: $usesGitHubApp) {
        message
      }
      ... on GitHubSchemaCheckError @include(if: $usesGitHubApp) {
        message
      }
    }
  }
`);

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'schema:check <file>',
    'checks schema',
    y =>
      y
        .positional('file', {
          type: 'string',
          demandOption: true,
          description: 'Path to the schema file(s)',
        })
        .option('service', {
          type: 'string',
          description: 'service name (only for distributed schemas)',
        })
        .option('commit', {
          type: 'string',
          description: 'Associated commit sha',
        })
        .option('author', {
          type: 'string',
          description: 'Author of the change',
        })
        .option('require', {
          type: 'string',
          array: true,
          description:
            'Loads specific require.extensions before running the codegen and reading the configuration',
          default: [],
        })
        .option('forceSafe', {
          type: 'boolean',
          description: 'mark the check as safe, breaking changes are expected',
        })
        .option('github', {
          type: 'boolean',
          description: 'Connect with GitHub Application',
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
      await ctx.require(args.require);

      const service = args.service;
      const forceSafe = args.forceSafe;
      const usesGitHubApp = args.github === true;

      const endpoint = ctx.ensure({
        key: 'registry.endpoint',
        legacyFlagName: 'registry',
        args,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const accessToken = ctx.ensure({
        key: 'registry.accessToken',
        legacyFlagName: 'token',
        args,
        env: 'HIVE_TOKEN',
      });
      const file = args.file;
      const sdl = await loadSchema(file);
      const git = await gitInfo(() => {
        // noop
      });

      const commit = args.commit || git?.commit;
      const author = args.author || git?.author;

      invariant(typeof sdl === 'string' && sdl.length > 0, 'Schema seems empty');

      if (usesGitHubApp) {
        invariant(
          typeof commit === 'string',
          `Couldn't resolve commit sha required for GitHub Application`,
        );
      }

      const result = await ctx
        .graphql(endpoint, accessToken)
        .request(schemaCheckMutation, {
          input: {
            service,
            sdl: minifySchema(sdl),
            github: usesGitHubApp
              ? {
                  commit: commit!,
                }
              : null,
            meta:
              !!commit && !!author
                ? {
                    commit,
                    author,
                  }
                : null,
          },
          usesGitHubApp,
        })
        .catch(error => {
          return ctx.handleFetchError(error);
        });

      if (result.schemaCheck.__typename === 'SchemaCheckSuccess') {
        const changes = result.schemaCheck.changes;
        if (result.schemaCheck.initial) {
          ctx.logger.success('Schema registry is empty, nothing to compare your schema with.');
        } else if (!changes?.total) {
          ctx.logger.success('No changes');
        } else {
          renderChanges(ctx, changes);
          ctx.logger.log('');
        }

        const warnings = result.schemaCheck.warnings;
        if (warnings?.total) {
          renderWarnings(ctx, warnings);
          ctx.logger.log('');
        }

        if (result.schemaCheck.schemaCheck?.webUrl) {
          ctx.logger.log(`View full report:\n${result.schemaCheck.schemaCheck.webUrl}`);
        }
      } else if (result.schemaCheck.__typename === 'SchemaCheckError') {
        const changes = result.schemaCheck.changes;
        const errors = result.schemaCheck.errors;
        const warnings = result.schemaCheck.warnings;
        renderErrors(ctx, errors);

        if (warnings?.total) {
          renderWarnings(ctx, warnings);
          ctx.logger.log('');
        }

        if (changes && changes.total) {
          ctx.logger.log('');
          renderChanges(ctx, changes);
        }

        if (result.schemaCheck.schemaCheck?.webUrl) {
          ctx.logger.log('');
          ctx.logger.log(`View full report:\n${result.schemaCheck.schemaCheck.webUrl}`);
        }

        ctx.logger.log('');

        if (forceSafe) {
          ctx.logger.success('Breaking changes were expected (forced)');
        } else {
          ctx.exit('failure');
        }
      } else if (result.schemaCheck.__typename === 'GitHubSchemaCheckSuccess') {
        ctx.logger.success(result.schemaCheck.message);
      } else {
        ctx.logger.fail(result.schemaCheck.message);
      }
    },
  );
});
