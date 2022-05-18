import { Flags, Errors } from '@oclif/core';
import Command from '../../base-command';
import { loadOperations } from '../../helpers/operations';

export default class OperationsPublish extends Command {
  static description = 'saves operations to the store';
  static flags = {
    registry: Flags.string({
      description: 'registry address',
    }),
    token: Flags.string({
      description: 'api token',
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

      const registry = this.ensure({
        key: 'registry',
        args: flags,
        defaultValue: 'https://app.graphql-hive.com/registry',
        env: 'HIVE_REGISTRY',
      });
      const file: string = args.file;
      const token = this.ensure({
        key: 'token',
        args: flags,
        env: 'HIVE_TOKEN',
      });

      let operations = await loadOperations(file, {
        normalize: true,
      });
      const collectedOperationsTotal = operations.length;
      const noMissingHashes = operations.some((op) => !!op.operationHash);

      if (noMissingHashes) {
        const comparisonResult = await this.registryApi(
          registry,
          token
        ).comparePersistedOperations({
          hashes: operations.map((op) => op.operationHash!),
        });

        const operationsToPublish = comparisonResult.comparePersistedOperations;

        operations = operations.filter((op) =>
          operationsToPublish.includes(op.operationHash!)
        );
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
          ].join('\n')
        );
      }

      const result = await this.registryApi(
        registry,
        token
      ).publishPersistedOperations({
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
          ].join('\n')
        );
      } else {
        this.error('OOPS! An error occurred in publishing the operation(s)');
      }
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        const parsedError: Error & { response?: any } =
          error instanceof Error ? error : new Error(error as string);
        this.fail('Failed to publish operations');

        if ('response' in parsedError) {
          this.error(parsedError.response.errors[0].message, {
            ref: this.cleanRequestId(
              parsedError.response?.headers?.get('x-request-id')
            ),
          });
        } else {
          this.error(parsedError);
        }
      }
    }
  }
}
