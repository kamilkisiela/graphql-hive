import { existsSync, readFileSync } from 'node:fs';
import { GraphQLError, print } from 'graphql';
import { transformCommentsToDescriptions } from '@graphql-tools/utils';
import { graphql } from '../../gql';
import { createCommand } from '../../helpers/command';
import { graphqlEndpoint } from '../../helpers/config';
import { gitInfo } from '../../helpers/git';
import { loadSchema, minifySchema, renderChanges, renderErrors } from '../../helpers/schema';
import { invariant } from '../../helpers/validation';

const schemaPublishMutation = graphql(/* GraphQL */ `
  mutation schemaPublish($input: SchemaPublishInput!, $usesGitHubApp: Boolean!) {
    schemaPublish(input: $input) {
      __typename
      ... on SchemaPublishSuccess @skip(if: $usesGitHubApp) {
        initial
        valid
        successMessage: message
        linkToWebsite
        changes {
          nodes {
            message
            criticality
          }
          total
        }
      }
      ... on SchemaPublishError @skip(if: $usesGitHubApp) {
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
      ... on SchemaPublishMissingServiceError @skip(if: $usesGitHubApp) {
        missingServiceError: message
      }
      ... on SchemaPublishMissingUrlError @skip(if: $usesGitHubApp) {
        missingUrlError: message
      }
      ... on GitHubSchemaPublishSuccess @include(if: $usesGitHubApp) {
        message
      }
      ... on GitHubSchemaPublishError @include(if: $usesGitHubApp) {
        message
      }
    }
  }
`);

export default createCommand((yargs, ctx) =>
  yargs.command(
    'schema:publish <file>',
    'publishes schema',
    y =>
      y
        .positional('file', {
          type: 'string',
          demandOption: true,
          description: 'Path to the schema file(s)',
        })
        .option('commit', {
          type: 'string',
          description: 'Associated commit sha',
        })
        .option('author', {
          type: 'string',
          description: 'Author of the change',
        })
        .option('service', {
          type: 'string',
          description: 'service name (only for distributed schemas)',
        })
        .option('url', {
          type: 'string',
          description: 'service url (only for distributed schemas)',
        })
        .option('metadata', {
          type: 'string',
          description: 'additional metadata to attach to the GraphQL schema',
        })
        .option('force', {
          type: 'boolean',
          description: 'force publish even on breaking changes',
          default: false,
          deprecated: '--force is enabled by default for newly created projects',
        })
        .option('experimental_acceptBreakingChanges', {
          type: 'boolean',
          description:
            '(experimental) accept breaking changes and mark schema as valid (only if composable)',
          deprecated:
            '--experimental_acceptBreakingChanges is enabled by default for newly created projects',
        })
        .option('require', {
          type: 'string',
          array: true,
          description:
            'Loads specific require.extensions before running the codegen and reading the configuration',
          default: [],
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
      const service = args.service;
      const url = args.url;
      const file = args.file;
      const force = args.force;
      const experimental_acceptBreakingChanges = args.experimental_acceptBreakingChanges;
      const metadata = resolveMetadata(args.metadata);
      const usesGitHubApp = args.github;

      let commit: string | undefined | null = ctx.maybe({
        key: 'commit',
        args,
        env: 'HIVE_COMMIT',
      });
      let author: string | undefined | null = ctx.maybe({
        key: 'author',
        args,
        env: 'HIVE_AUTHOR',
      });

      if (!commit || !author) {
        const git = await gitInfo(() => {
          ctx.logger.infoWarning(`No git information found. Couldn't resolve author and commit.`);
        });

        if (!commit) {
          commit = git.commit;
        }

        if (!author) {
          author = git.author;
        }
      }

      if (!author) {
        return ctx.exit('failure', {
          message: `Missing "author"`,
        });
      }

      if (!commit) {
        return ctx.exit('failure', { message: `Missing "commit"` });
      }

      let sdl: string;
      try {
        const rawSdl = await loadSchema(file);
        invariant(typeof rawSdl === 'string' && rawSdl.length > 0, 'Schema seems empty');
        const transformedSDL = print(transformCommentsToDescriptions(rawSdl));
        sdl = minifySchema(transformedSDL);
      } catch (err) {
        if (err instanceof GraphQLError) {
          const location = err.locations?.[0];
          const locationString = location
            ? ` at line ${location.line}, column ${location.column}`
            : '';
          throw new Error(`The SDL is not valid${locationString}:\n ${err.message}`);
        }
        throw err;
      }

      const result = await ctx.graphql(endpoint, accessToken).request(schemaPublishMutation, {
        input: {
          service,
          url,
          author,
          commit,
          sdl,
          force,
          experimental_acceptBreakingChanges: experimental_acceptBreakingChanges === true,
          metadata,
          github: usesGitHubApp,
        },
        usesGitHubApp,
      });

      if (result.schemaPublish.__typename === 'SchemaPublishSuccess') {
        const changes = result.schemaPublish.changes;

        if (result.schemaPublish.initial) {
          ctx.logger.success('Published initial schema.');
        } else if (result.schemaPublish.successMessage) {
          ctx.logger.success(result.schemaPublish.successMessage);
        } else if (changes && changes.total === 0) {
          ctx.logger.success('No changes. Skipping.');
        } else {
          if (changes) {
            renderChanges(ctx, changes);
          }
          ctx.logger.success('Schema published');
        }

        if (result.schemaPublish.linkToWebsite) {
          ctx.logger.info(`Available at ${result.schemaPublish.linkToWebsite}`);
        }
      } else if (result.schemaPublish.__typename === 'SchemaPublishMissingServiceError') {
        ctx.exit('failure', {
          message: `${result.schemaPublish.missingServiceError} Please use the '--service <name>' parameter.`,
        });
      } else if (result.schemaPublish.__typename === 'SchemaPublishMissingUrlError') {
        ctx.exit('failure', {
          message: `${result.schemaPublish.missingUrlError} Please use the '--url <url>' parameter.`,
        });
      } else if (result.schemaPublish.__typename === 'SchemaPublishError') {
        const changes = result.schemaPublish.changes;
        const errors = result.schemaPublish.errors;
        renderErrors(ctx, errors);

        if (changes && changes.total) {
          ctx.logger.log('');
          renderChanges(ctx, changes);
        }
        ctx.logger.log('');

        if (!force) {
          ctx.exit('failure', {
            message: 'Failed to publish schema',
          });
        } else {
          ctx.logger.success('Schema published (forced)');
        }

        if (result.schemaPublish.linkToWebsite) {
          ctx.logger.info(`Available at ${result.schemaPublish.linkToWebsite}`);
        }
      } else if (result.schemaPublish.__typename === 'GitHubSchemaPublishSuccess') {
        ctx.logger.success(result.schemaPublish.message);
      } else {
        ctx.exit('failure', {
          message:
            'message' in result.schemaPublish ? result.schemaPublish.message : 'Unknown error',
        });
      }
    },
  ),
);

function resolveMetadata(metadata: string | undefined): string | undefined {
  if (!metadata) {
    return;
  }

  try {
    JSON.parse(metadata);
    // If we are able to parse it, it means it's a valid JSON, let's use it as-is

    return metadata;
  } catch (e) {
    // If we can't parse it, we can try to load it from FS
    const exists = existsSync(metadata);

    if (!exists) {
      throw new Error(
        `Failed to load metadata from "${metadata}": Please specify a path to an existing file, or a string with valid JSON.`,
      );
    }

    try {
      const fileContent = readFileSync(metadata, 'utf-8');
      JSON.parse(fileContent);

      return fileContent;
    } catch (e) {
      throw new Error(
        `Failed to load metadata from file "${metadata}": Please make sure the file is readable and contains a valid JSON`,
      );
    }
  }
}
