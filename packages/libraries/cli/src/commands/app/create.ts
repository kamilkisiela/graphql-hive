import { z } from 'zod';
import { Args, Flags } from '@oclif/core';
import Command from '../../base-command';
import { graphql } from '../../gql';
import { AppDeploymentStatus } from '../../gql/graphql';
import { graphqlEndpoint } from '../../helpers/config';

export default class AppCreate extends Command {
  static description = 'create an app deployment';
  static flags = {
    'registry.endpoint': Flags.string({
      description: 'registry endpoint',
    }),
    'registry.accessToken': Flags.string({
      description: 'registry access token',
    }),
    name: Flags.string({
      description: 'app name',
      required: true,
    }),
    version: Flags.string({
      description: 'app version',
      required: true,
    }),
  };

  static args = {
    file: Args.string({
      name: 'file',
      required: true,
      description: 'Path to the persisted operations mapping.',
      hidden: false,
    }),
  };

  async run() {
    const { flags, args } = await this.parse(AppCreate);

    const endpoint = this.ensure({
      key: 'registry.endpoint',
      args: flags,
      defaultValue: graphqlEndpoint,
      env: 'HIVE_REGISTRY',
    });
    const accessToken = this.ensure({
      key: 'registry.accessToken',
      args: flags,
      env: 'HIVE_TOKEN',
    });

    const file: string = args.file;
    const fs = await import('fs/promises');
    const contents = await fs.readFile(file, 'utf-8');
    const operations: unknown = JSON.parse(contents);
    const validationResult = ManifestModel.safeParse(operations);

    if (validationResult.success === false) {
      // TODO: better error message :)
      throw new Error('Invalid manifest');
    }

    const result = await this.registryApi(endpoint, accessToken).request(
      CreateAppDeploymentMutation,
      {
        input: {
          appName: flags['name'],
          appVersion: flags['version'],
        },
      },
    );

    if (result.createAppDeployment.error) {
      // TODO: better error message formatting :)
      throw new Error(result.createAppDeployment.error.message);
    }

    if (!result.createAppDeployment.ok) {
      throw new Error('Unknown error');
    }

    if (result.createAppDeployment.ok.createdAppDeployment.status !== AppDeploymentStatus.Pending) {
      this.log(
        `App deployment "${flags['name']}@${flags['version']}" is "${result.createAppDeployment.ok.createdAppDeployment.status}". Skip publishing documents.`,
      );
      return;
    }

    let buffer: Array<{ hash: string; body: string }> = [];

    const flush = async (force = false) => {
      if (buffer.length >= 100 || force) {
        const result = await this.registryApi(endpoint, accessToken).request(
          AddDocumentsToAppDeploymentMutation,
          {
            input: {
              appName: flags['name'],
              appVersion: flags['version'],
              documents: buffer,
            },
          },
        );

        if (result.addDocumentsToAppDeployment.error) {
          // TODO: better error message formatting :)
          throw new Error(result.addDocumentsToAppDeployment.error.message);
        }
        buffer = [];
      }
    };

    let counter = 0;

    for (const [hash, body] of Object.entries(validationResult.data)) {
      buffer.push({ hash, body });
      await flush();
      counter++;
    }

    await flush(true);

    this.log(
      `\nApp deployment "${flags['name']}@${flags['version']}" (${counter} operations) created.\nActive it with the "hive app:publish" command.`,
    );
  }
}

const ManifestModel = z.record(z.string());

const CreateAppDeploymentMutation = graphql(/* GraphQL */ `
  mutation CreateAppDeployment($input: CreateAppDeploymentInput!) {
    createAppDeployment(input: $input) {
      ok {
        createdAppDeployment {
          id
          name
          version
          status
        }
      }
      error {
        message
      }
    }
  }
`);

const AddDocumentsToAppDeploymentMutation = graphql(/* GraphQL */ `
  mutation AddDocumentsToAppDeployment($input: AddDocumentsToAppDeploymentInput!) {
    addDocumentsToAppDeployment(input: $input) {
      ok {
        appDeployment {
          id
          name
          version
          status
        }
      }
      error {
        message
      }
    }
  }
`);
