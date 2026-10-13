import { Args, Errors, Flags } from '@oclif/core';
import Command from '../../base-command';
import { DocumentType, graphql } from '../../gql';
import * as GraphQLSchema from '../../gql/graphql';
import { graphqlEndpoint } from '../../helpers/config';
import {
  APIError,
  AuthorRequiredError,
  CommitRequiredError,
  ConflictingOptionsError,
  InvalidTargetError,
  MissingArgumentsError,
  MissingEndpointError,
  MissingEnvironmentError,
  MissingRegistryTokenError,
  SchemaPublishFailedError,
  SchemaPublishMissingServiceError,
  SchemaPublishMissingUrlError,
  UnexpectedError,
} from '../../helpers/errors';
import { gitInfo } from '../../helpers/git';
import { loadSchemaSdl, minifySchema, renderChanges, renderErrors } from '../../helpers/schema';
import * as TargetInput from '../../helpers/target-input';
import { Texture } from '../../helpers/texture/texture';

const schemaPublishMutation = graphql(/* GraphQL */ `
  mutation schemaPublish($input: SchemaPublishInput!) {
    schemaPublish(input: $input) {
      __typename
      ... on SchemaPublishSuccess {
        initial
        valid
        successMessage: message
        linkToWebsite
        changes {
          edges {
            __typename
          }
          ...RenderChanges_schemaChanges
        }
      }
      ... on SchemaPublishError {
        valid
        linkToWebsite
        changes {
          edges {
            __typename
          }
          ...RenderChanges_schemaChanges
        }
        errors {
          ...RenderErrors_SchemaErrorConnectionFragment
        }
      }
      ... on SchemaPublishMissingServiceError {
        missingServiceError: message
      }
      ... on SchemaPublishMissingUrlError {
        missingUrlError: message
      }
      ... on SchemaPublishRetry {
        reason
      }
      ... on GitHubSchemaPublishSuccess {
        message
      }
      ... on GitHubSchemaPublishError {
        message
      }
    }
  }
`);

/** Only used with `--github`, so that servers without this field keep working for other publishes. */
const schemaPublishGitHubMutation = graphql(/* GraphQL */ `
  mutation CLI_SchemaPublishGitHubMutation($input: SchemaPublishInput!) {
    schemaPublish(input: $input) {
      __typename
      ... on SchemaPublishSuccess {
        initial
        valid
        successMessage: message
        linkToWebsite
        changes {
          edges {
            __typename
          }
          ...RenderChanges_schemaChanges
        }
      }
      ... on SchemaPublishError {
        valid
        linkToWebsite
        changes {
          edges {
            __typename
          }
          ...RenderChanges_schemaChanges
        }
        errors {
          ...RenderErrors_SchemaErrorConnectionFragment
        }
      }
      ... on SchemaPublishMissingServiceError {
        missingServiceError: message
      }
      ... on SchemaPublishMissingUrlError {
        missingUrlError: message
      }
      ... on SchemaPublishRetry {
        reason
      }
      ... on GitHubSchemaPublishSuccess {
        message
        isValid
      }
      ... on GitHubSchemaPublishError {
        message
      }
    }
  }
`);

/** GitHub results are only returned for requests that use `schemaPublishGitHubMutation`. */
type GitHubSchemaPublishSuccessResult = Extract<
  DocumentType<typeof schemaPublishGitHubMutation>['schemaPublish'],
  { __typename: 'GitHubSchemaPublishSuccess' }
>;

export default class SchemaPublish extends Command<typeof SchemaPublish> {
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
    author: Flags.string({
      description: 'author of the change',
    }),
    commit: Flags.string({
      description:
        'The associated commit SHA, or optionally any external identifier that references the schema',
    }),
    revision: Flags.string({
      description: 'publish a previously pushed schema revision',
    }),
    github: Flags.boolean({
      description: 'Connect with GitHub Application',
      default: false,
    }),
    force: Flags.boolean({
      description: 'force publish even on breaking changes',
      deprecated: {
        message: '--force is enabled by default for newly created projects',
      },
    }),
    experimental_acceptBreakingChanges: Flags.boolean({
      description:
        '(experimental) accept breaking changes and mark schema as valid (only if composable)',
      deprecated: {
        message:
          '--experimental_acceptBreakingChanges is enabled by default for newly created projects',
      },
    }),
    'fail-on-composition-error': Flags.boolean({
      description: 'prevent publishing a federation schema if it would cause a composition error',
    }),
    require: Flags.string({
      description:
        'Loads specific require.extensions before running the codegen and reading the configuration',
      default: [],
      multiple: true,
    }),
    target: Flags.string({
      description:
        'The target to which to publish to (slug or ID).' +
        ' This can either be a slug following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g "the-guild/graphql-hive/staging")' +
        ' or an UUID (e.g. "a0f4c605-6541-4350-8cfe-b31f21a4bf80").',
    }),
  };

  static args = {
    file: Args.string({
      name: 'file',
      required: false,
      description: 'Path to the schema file(s), must be omitted when using --revision',
      hidden: false,
    }),
  };

  resolveMetadata = (metadata: string | undefined): string | undefined => {
    if (!metadata) {
      return;
    }

    try {
      JSON.parse(metadata);
      // If we are able to parse it, it means it's a valid JSON, let's use it as-is

      return metadata;
    } catch (e) {
      this.logDebug(e);
      // If we can't parse it, we can try to load it from FS
      return this.readJSON(metadata);
    }
  };

  async run() {
    try {
      const { flags, args } = await this.parse(SchemaPublish);

      await this.require(flags);

      let endpoint: string, accessToken: string;
      try {
        endpoint = this.ensure({
          key: 'registry.endpoint',
          args: flags,
          legacyFlagName: 'registry',
          defaultValue: graphqlEndpoint,
          env: 'HIVE_REGISTRY',
          description: SchemaPublish.flags['registry.endpoint'].description!,
        });
      } catch (e) {
        throw e instanceof MissingArgumentsError ? new MissingEndpointError() : e;
      }
      try {
        accessToken = this.ensure({
          key: 'registry.accessToken',
          args: flags,
          legacyFlagName: 'token',
          env: 'HIVE_TOKEN',
          description: SchemaPublish.flags['registry.accessToken'].description!,
        });
      } catch (e) {
        throw e instanceof MissingArgumentsError ? new MissingRegistryTokenError() : e;
      }
      const service = flags.service;
      const url = flags.url;
      const file = args.file;
      const revision = flags.revision;
      const force = flags.force;
      const experimental_acceptBreakingChanges = flags.experimental_acceptBreakingChanges;
      const metadata = this.resolveMetadata(flags.metadata);
      const usesGitHubApp = flags.github;

      let commit: string | undefined | null = this.maybe({
        key: 'commit',
        args: flags,
        env: 'HIVE_COMMIT',
      });
      let author: string | undefined | null = this.maybe({
        key: 'author',
        args: flags,
        env: 'HIVE_AUTHOR',
      });

      let gitHub: null | {
        repository: string;
        commit: string;
      } = null;

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
        throw new AuthorRequiredError();
      }

      if (!commit) {
        throw new CommitRequiredError();
      }

      if (usesGitHubApp) {
        // eslint-disable-next-line no-process-env
        const repository = process.env['GITHUB_REPOSITORY'] ?? null;
        if (!repository) {
          throw new MissingEnvironmentError([
            'GITHUB_REPOSITORY',
            'Github repository full name, e.g. graphql-hive/console',
          ]);
        }
        gitHub = {
          repository,
          commit,
        };
      }

      let target: GraphQLSchema.TargetReferenceInput | null = null;
      if (flags.target) {
        const result = TargetInput.parse(flags.target);
        if (result.type === 'error') {
          throw new InvalidTargetError();
        }
        target = result.data;
      }

      if (revision && file) {
        throw new ConflictingOptionsError(
          ['FILE', '--revision'],
          'A pushed revision already contains the schema, so the FILE argument must be omitted.',
        );
      }

      let schema: GraphQLSchema.SchemaPublishSchemaInput | null = null;
      if (revision) {
        schema = { revision: revision };
      } else {
        if (!file) {
          throw new MissingArgumentsError(['file', 'Path to the schema file(s)']);
        }
        const rawSdl = await loadSchemaSdl(file, { logger: this.logger });
        schema = { sdl: minifySchema(rawSdl) };
      }

      /** A rejected publish did not store anything. `--force` has no effect on the server. */
      const handleRejectedPublish = (linkToWebsite?: string | null) => {
        if (force) {
          this.logSuccess('Schema published (forced)');
          if (linkToWebsite) {
            this.logInfo(`Available at ${linkToWebsite}`);
          }
          return;
        }
        throw new SchemaPublishFailedError(linkToWebsite ? `See ${linkToWebsite}` : null);
      };

      const input: GraphQLSchema.SchemaPublishInput = {
        service,
        url,
        author,
        commit,
        schema,
        force,
        experimental_acceptBreakingChanges: experimental_acceptBreakingChanges === true,
        failOnCompositionError: flags['fail-on-composition-error'],
        metadata,
        gitHub,
        supportsRetry: true,
        target,
      };

      const api = this.registryApi(endpoint, accessToken);
      /** Gateway timeout is 60 seconds. */
      const timeout = 55_000;

      let result:
        | DocumentType<typeof schemaPublishMutation>
        | DocumentType<typeof schemaPublishGitHubMutation>
        | null = null;

      do {
        result = usesGitHubApp
          ? await api.request({
              operation: schemaPublishGitHubMutation,
              variables: { input },
              timeout,
            })
          : await api.request({
              operation: schemaPublishMutation,
              variables: { input },
              timeout,
            });

        const payload = result.schemaPublish;

        if (payload.__typename === 'SchemaPublishSuccess') {
          const changes = payload.changes;

          if (payload.initial) {
            this.logSuccess('Published initial schema.');
          } else if (payload.successMessage) {
            this.logSuccess(payload.successMessage);
          } else if (changes?.edges?.length === 0) {
            this.logSuccess('No changes. Skipping.');
          } else {
            if (changes) {
              this.log(renderChanges(changes));
            }
            this.logSuccess('Schema published');
          }

          if (payload.linkToWebsite) {
            this.logInfo(`Available at ${payload.linkToWebsite}`);
          }
        } else if (payload.__typename === 'SchemaPublishRetry') {
          this.log(payload.reason);
          this.log('Waiting for other schema publishes to complete...');
          result = null;
        } else if (payload.__typename === 'SchemaPublishMissingServiceError') {
          throw new SchemaPublishMissingServiceError(payload.missingServiceError);
        } else if (payload.__typename === 'SchemaPublishMissingUrlError') {
          throw new SchemaPublishMissingUrlError(payload.missingUrlError);
        } else if (payload.__typename === 'SchemaPublishError') {
          const changes = payload.changes;
          const errors = payload.errors;
          if (errors) {
            this.log(renderErrors(errors));
          }

          if (changes?.edges.length) {
            this.log('');
            this.log(renderChanges(changes));
          }
          this.log('');

          handleRejectedPublish(payload.linkToWebsite);
        } else if (payload.__typename === 'GitHubSchemaPublishSuccess') {
          const gitHubResult = payload as GitHubSchemaPublishSuccessResult;
          if (gitHubResult.isValid) {
            this.logSuccess(gitHubResult.message);
          } else {
            this.log(Texture.failure(gitHubResult.message));
            handleRejectedPublish();
          }
        } else {
          throw new APIError(payload.message);
        }
      } while (result === null);
    } catch (error) {
      if (error instanceof Errors.CLIError) {
        throw error;
      } else {
        this.logFailure('Failed to publish schema');
        throw new UnexpectedError(error instanceof Error ? error.message : JSON.stringify(error));
      }
    }
  }
}
