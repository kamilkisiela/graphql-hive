import { Errors, Flags } from '@oclif/core';
import Command from '../../base-command';
import { graphqlEndpoint } from '../../helpers/config';
import { loadOperations } from '../../helpers/operations';

export default class OperationsPublish extends Command {
  static description = 'saves operations to the store';
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
      description: 'Glob pattern to find the operations',
      hidden: false,
    },
  ];

  async run() {
    try {
      const { flags, args } = await this.parse(OperationsPublish);

      await this.require(flags);

      const endpoint = this.ensure({
        key: 'registry.endpoint',
        args: flags,
        legacyFlagName: flags.registry,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const accessToken = this.ensure({
        key: 'registry.accessToken',
        args: flags,
        legacyFlagName: flags.token,
        env: 'HIVE_TOKEN',
      });
      const file: string = args.file;

      let operations = await loadOperations(file, {
        normalize: true,
      });
      const collectedOperationsTotal = operations.length;
      const noMissingHashes = operations.some(op => op.operationHash);

      if (noMissingHashes) {
        const comparisonResult = await this.registryApi(
          endpoint,
          accessToken,
        ).comparePersistedOperations({
          hashes: operations.map(op => op.operationHash!),
        });

        const operationsToPublish = comparisonResult.comparePersistedOperations;

        operations = operations.filter(op => operationsToPublish.includes(op.operationHash!));
      }

      const unchangedTotal = collectedOperationsTotal - operations.length;

      if (!operations.length) {
        return this.success(
          [
            `Nothing to publish`,
            '',
            `  Total: ${collectedOperationsTotal}`,
            `  Unchanged: ${unchangedTotal}`,
            '',
          ].join('\n'),
        );
      }

      const result = await this.registryApi(endpoint, accessToken).publishPersistedOperations({
        input: operations,
      });

      if (result.publishPersistedOperations) {
        const summary = result.publishPersistedOperations.summary;
        this.success(
          [
            'Operations successfully published!',
            '',
            `  Total: ${summary.total}`,
            `  Unchanged: ${summary.unchanged}`,
            '',
          ].join('\n'),
        );
      } else {
        this.error('OOPS! An error occurred in publishing the operation(s)');
      }
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        this.fail('Failed to publish operations');
        this.handleFetchError(error);
      }
    }
  }
}
