import { Flags, Errors } from '@oclif/core';
import { buildSchema, Source, GraphQLError } from 'graphql';
import { validate, InvalidDocument } from '@graphql-inspector/core';
import Command from '../../base-command';
import { loadOperations } from '../../helpers/operations';
import { graphqlEndpoint } from '../../helpers/config';

export default class OperationsCheck extends Command {
  static description = 'checks operations against a published schema';
  static flags = {
    registry: Flags.string({
      description: 'registry address',
    }),
    token: Flags.string({
      description: 'api token',
    }),
    require: Flags.string({
      description: 'Loads specific require.extensions before running the command',
      default: [],
      multiple: true,
    }),
  };

  static args = [
    {
      name: 'file',
      required: true,
      description: 'Glob pattern to find the operations',
      hidden: false,
    },
  ];

  async run() {
    try {
      const { flags, args } = await this.parse(OperationsCheck);

      await this.require(flags);

      const registry = this.ensure({
        key: 'registry',
        args: flags,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const file: string = args.file;
      const token = this.ensure({
        key: 'token',
        args: flags,
        env: 'HIVE_TOKEN',
      });

      const operations = await loadOperations(file, {
        normalize: false,
      });

      if (operations.length === 0) {
        this.info('No operations found');
        this.exit(0);
        return;
      }

      const result = await this.registryApi(registry, token).fetchLatestVersion();

      const sdl = result.latestVersion.sdl;

      if (!sdl) {
        this.error('No schema found');
      }

      const schema = buildSchema(sdl, {
        assumeValidSDL: true,
        assumeValid: true,
      });

      const invalidOperations = validate(
        schema,
        operations.map(s => new Source(s.content, s.location))
      );

      if (invalidOperations.length === 0) {
        this.success('All operations are valid');
        this.exit(0);
        return;
      }

      this.fail('Some operations are invalid');

      this.log(['', `Total: ${operations.length}`, `Invalid: ${invalidOperations.length}`, ''].join('\n'));

      this.printInvalidDocuments(invalidOperations, 'errors');
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        this.fail('Failed to validate operations');
        this.handleFetchError(error);
      }
    }
  }

  private printInvalidDocuments(invalidDocuments: InvalidDocument[], listKey: 'errors' | 'deprecated'): void {
    invalidDocuments.forEach(doc => {
      if (doc.errors.length) {
        this.renderErrors(doc.source.name, doc[listKey]).forEach(line => {
          this.log(line);
        });
      }
    });
  }

  private renderErrors(sourceName: string, errors: GraphQLError[]): string[] {
    const errorsAsString = errors.map(e => ` - ${this.bolderize(e.message)}`).join('\n');

    return [`ERROR in ${sourceName}:\n`, errorsAsString, '\n\n'];
  }
}
