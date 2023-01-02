import { existsSync, readFileSync } from 'fs';
import { transformCommentsToDescriptions } from '@graphql-tools/utils';
import { Errors, Flags } from '@oclif/core';
import { GraphQLError, print } from 'graphql';
import Command from '../../base-command';
import { graphqlEndpoint } from '../../helpers/config';
import { gitInfo } from '../../helpers/git';
import { loadSchema, minifySchema, renderChanges, renderErrors } from '../../helpers/schema';
import { invariant } from '../../helpers/validation';

export default class SchemaPublish extends Command {
  static description = 'publishes schema';
  static flags = {
    service: Flags.string({
      description: 'service name (only for distributed schemas)',
    }),
    url: Flags.string({
      description: 'service url (only for distributed schemas)',
    }),
    metadata: Flags.string({
      description:
        'additional metadata to attach to the GraphQL schema. This can be a string with a valid JSON, or a path to a file containing a valid JSON',
    }),
    registry: Flags.string({
      description: 'registry address',
    }),
    token: Flags.string({
      description: 'api token',
    }),
    author: Flags.string({
      description: 'author of the change',
    }),
    commit: Flags.string({
      description: 'associated commit sha',
    }),
    github: Flags.boolean({
      description: 'Connect with GitHub Application',
      default: false,
    }),
    force: Flags.boolean({
      description: 'force publish even on breaking changes',
      default: false,
      deprecated: {
        message: 'Enabled by default for newly created projects',
      },
    }),
    experimental_acceptBreakingChanges: Flags.boolean({
      description:
        '(experimental) accept breaking changes and mark schema as valid (only if composable)',
      deprecated: {
        message: 'Enabled by default for newly created projects',
      },
    }),
    require: Flags.string({
      description:
        'Loads specific require.extensions before running the codegen and reading the configuration',
      default: [],
      multiple: true,
    }),
  };

  static args = [
    {
      name: 'file',
      required: true,
      description: 'Path to the schema file(s)',
      hidden: false,
    },
  ];

  resolveMetadata(metadata: string | undefined): string | undefined {
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

  async run() {
    try {
      const { flags, args } = await this.parse(SchemaPublish);

      await this.require(flags);

      const registry = this.ensure({
        key: 'registry',
        args: flags,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const service = this.maybe('service', flags);
      const url = this.maybe('url', flags);
      const file = args.file;
      const token = this.ensure({
        key: 'token',
        args: flags,
        env: 'HIVE_TOKEN',
      });
      const force = this.maybe('force', flags);
      const experimental_acceptBreakingChanges = this.maybe(
        'experimental_acceptBreakingChanges',
        flags,
      );
      const metadata = this.resolveMetadata(this.maybe('metadata', flags));
      const usesGitHubApp = this.maybe('github', flags) === true;

      let commit: string | undefined | null = flags.commit;
      let author: string | undefined | null = flags.author;

      if (!commit || !author) {
        const git = await gitInfo(() => {
          this.warn(`No git information found. Couldn't resolve author and commit.`);
        });

        if (!commit) {
          commit = git.commit;
        }

        if (!author) {
          author = git.author;
        }
      }

      if (!author) {
        throw new Errors.CLIError(`Missing "author"`);
      }

      if (!commit) {
        throw new Errors.CLIError(`Missing "commit"`);
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

      const result = await this.registryApi(registry, token).schemaPublish({
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
          this.success('Published initial schema.');
        } else if (result.schemaPublish.successMessage) {
          this.success(result.schemaPublish.successMessage);
        } else if (!changes?.total) {
          this.success('No changes. Skipping.');
        } else {
          renderChanges.call(this, changes);
          this.success('Schema published');
        }

        if (result.schemaPublish.linkToWebsite) {
          this.info(`Available at ${result.schemaPublish.linkToWebsite}`);
        }
      } else if (result.schemaPublish.__typename === 'SchemaPublishMissingServiceError') {
        this.fail(
          `${result.schemaPublish.missingServiceError} Please use the '--service <name>' parameter.`,
        );
        this.exit(1);
      } else if (result.schemaPublish.__typename === 'SchemaPublishMissingUrlError') {
        this.fail(
          `${result.schemaPublish.missingUrlError} Please use the '--url <url>' parameter.`,
        );
        this.exit(1);
      } else if (result.schemaPublish.__typename === 'SchemaPublishError') {
        const changes = result.schemaPublish.changes;
        const errors = result.schemaPublish.errors;
        renderErrors.call(this, errors);

        if (changes && changes.total) {
          this.log('');
          renderChanges.call(this, changes);
        }
        this.log('');

        if (!force) {
          this.fail('Failed to publish schema');
          this.exit(1);
        } else {
          this.success('Schema published (forced)');
        }

        if (result.schemaPublish.linkToWebsite) {
          this.info(`Available at ${result.schemaPublish.linkToWebsite}`);
        }
      } else if (result.schemaPublish.__typename === 'GitHubSchemaPublishSuccess') {
        this.success(result.schemaPublish.message);
      } else {
        this.error(
          'message' in result.schemaPublish ? result.schemaPublish.message : 'Unknown error',
        );
      }
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        this.fail('Failed to publish schema');
        this.handleFetchError(error);
      }
    }
  }
}
