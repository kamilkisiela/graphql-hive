import { Flags, Errors, CliUx } from '@oclif/core';
import { renderErrors } from '../../helpers/schema';
import { graphqlEndpoint } from '../../helpers/config';
import Command from '../../base-command';

export default class SchemaDelete extends Command {
  static description = 'deletes a schema';
  static flags = {
    registry: Flags.string({
      description: 'Address of the registry',
    }),
    token: Flags.string({
      description: 'API token',
    }),
    dryRun: Flags.boolean({
      description: 'Does not delete the service, only reports what it would have done.',
      default: false,
    }),
    confirm: Flags.boolean({
      description: 'Confirm deletion of the service',
      default: false,
    }),
  };

  static args = [
    {
      name: 'service' as const,
      required: true,
      description: 'name of the service',
      hidden: false,
    },
  ];

  async run() {
    try {
      const { flags, args } = await this.parse(SchemaDelete);

      const service: string = args.service;

      if (!flags.confirm) {
        const confirmed = await CliUx.ux.confirm(
          `Are you sure you want to delete "${service}" from the registry? (y/n)`,
        );

        if (!confirmed) {
          this.info('Aborting');
          this.exit(0);
        }
      }

      const registry = this.ensure({
        key: 'registry',
        args: flags,
        defaultValue: graphqlEndpoint,
        env: 'HIVE_REGISTRY',
      });
      const token = this.ensure({
        key: 'token',
        args: flags,
        env: 'HIVE_TOKEN',
      });

      const result = await this.registryApi(registry, token).schemaDelete({
        input: {
          serviceName: service,
          dryRun: flags.dryRun,
        },
      });

      if (result.schemaDelete.__typename === 'SchemaDeleteSuccess') {
        this.success(`${service} deleted`);
        this.exit(0);
        return;
      }

      this.fail(`Failed to delete ${service}`);
      const errors = result.schemaDelete.errors;

      if (errors) {
        renderErrors.call(this, errors);
        this.exit(1);
      }
    } catch (error) {
      if (error instanceof Errors.ExitError) {
        throw error;
      } else {
        this.fail(`Failed to complete`);
        this.handleFetchError(error);
      }
    }
  }
}
