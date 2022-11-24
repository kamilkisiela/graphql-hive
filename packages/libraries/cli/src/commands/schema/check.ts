import { Flags, Errors } from '@oclif/core';
import { loadSchema, renderChanges, renderErrors, minifySchema } from '../../helpers/schema';
import { invariant } from '../../helpers/validation';
import { gitInfo } from '../../helpers/git';
import { graphqlEndpoint } from '../../helpers/config';
import Command from '../../base-command';

export default class SchemaCheck extends Command {
  static description = 'checks schema';
  static flags = {
    service: Flags.string({
      description: 'service name (only for distributed schemas)',
    }),
    registry: Flags.string({
      description: 'registry address',
    }),
    token: Flags.string({
      description: 'api token',
    }),
    forceSafe: Flags.boolean({
      description: 'mark the check as safe, breaking changes are expected',
    }),
    github: Flags.boolean({
      description: 'Connect with GitHub Application',
      default: false,
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

  async run() {
    try {
      const { flags, args } = await this.parse(SchemaCheck);

      await this.require(flags);

      const service = this.maybe('service', flags);
      const forceSafe = this.maybe('forceSafe', flags);
      const usesGitHubApp = this.maybe('github', flags) === true;
      const registry = this.ensure({
        key: 'registry',
        args: flags,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const file = args.file;
      const token = this.ensure({
        key: 'token',
        args: flags,
        env: 'HIVE_TOKEN',
      });
      const sdl = await loadSchema(file);
      const git = await gitInfo(() => {
        // noop
      });
      const commit = git.commit;

      invariant(typeof sdl === 'string' && sdl.length > 0, 'Schema seems empty');

      if (usesGitHubApp) {
        invariant(
          typeof commit === 'string',
          `Couldn't resolve commit sha required for GitHub Application`,
        );
      }

      const result = await this.registryApi(registry, token).schemaCheck({
        input: {
          service,
          sdl: minifySchema(sdl),
          github: usesGitHubApp
            ? {
                commit: commit!,
              }
            : null,
        },
        usesGitHubApp,
      });

      if (result.schemaCheck.__typename === 'SchemaCheckSuccess') {
        const changes = result.schemaCheck.changes;
        if (result.schemaCheck.initial) {
          this.success('Schema registry is empty, nothing to compare your schema with.');
        } else if (!changes?.total) {
          this.success('No changes');
        } else {
          renderChanges.call(this, changes);
          this.log('');
        }
      } else if (result.schemaCheck.__typename === 'SchemaCheckError') {
        const changes = result.schemaCheck.changes;
        const errors = result.schemaCheck.errors;
        renderErrors.call(this, errors);

        if (changes && changes.total) {
          this.log('');
          renderChanges.call(this, changes);
        }
        this.log('');

        if (forceSafe) {
          this.success('Breaking changes were expected (forced)');
        } else {
          this.exit(1);
        }
      } else if (result.schemaCheck.__typename === 'GitHubSchemaCheckSuccess') {
        this.success(result.schemaCheck.message);
      } else {
        this.error(result.schemaCheck.message);
      }
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        this.fail('Failed to check schema');
        this.handleFetchError(error);
      }
    }
  }
}
