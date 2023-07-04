import { buildSchema, GraphQLError, Source } from 'graphql';
import { InvalidDocument, validate } from '@graphql-inspector/core';
import { Args, Errors, Flags } from '@oclif/core';
import Command from '../../base-command';
import { graphql } from '../../gql';
import { graphqlEndpoint } from '../../helpers/config';
import { loadOperations } from '../../helpers/operations';

const fetchLatestVersionQuery = graphql(/* GraphQL */ `
  query fetchLatestVersion {
    latestValidVersion {
      sdl
    }
  }
`);

export default class OperationsCheck extends Command {
  static description = 'checks operations against a published schema';
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
    require: Flags.string({
      description: 'Loads specific require.extensions before running the command',
      default: [],
      multiple: true,
    }),
  };

  static args = {
    file: Args.string({
      name: 'file',
      required: true,
      description: 'Glob pattern to find the operations',
      hidden: false,
    }),
  };

  async run() {
    try {
      const { flags, args } = await this.parse(OperationsCheck);

      await this.require(flags);

      const endpoint = this.ensure({
        key: 'registry.endpoint',
        args: flags,
        legacyFlagName: 'registry',
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const accessToken = this.ensure({
        key: 'registry.accessToken',
        args: flags,
        legacyFlagName: 'token',
        env: 'HIVE_TOKEN',
      });
      const file: string = args.file;

      const operations = await loadOperations(file, {
        normalize: false,
      });

      if (operations.length === 0) {
        this.info('No operations found');
        this.exit(0);
        return;
      }

      const result = await this.registryApi(endpoint, accessToken).request(fetchLatestVersionQuery);

      const sdl = result.latestValidVersion?.sdl;

      if (!sdl) {
        this.error('Could not find a published schema. Please publish a valid schema first.');
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
        this.success('All operations are valid');
        this.exit(0);
        return;
      }

      this.fail('Some operations are invalid');

      this.log(
        ['', `Total: ${operations.length}`, `Invalid: ${invalidOperations.length}`, ''].join('\n'),
      );

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

  private printInvalidDocuments(
    invalidDocuments: InvalidDocument[],
    listKey: 'errors' | 'deprecated',
  ): void {
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
