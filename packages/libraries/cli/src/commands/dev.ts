import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Flags } from '@oclif/core';
import Command from '../base-command';
import { graphql } from '../gql';
import { graphqlEndpoint } from '../helpers/config';
import { loadSchema, renderErrors } from '../helpers/schema';
import { invariant } from '../helpers/validation';

const CLI_SchemaComposeMutation = graphql(/* GraphQL */ `
  mutation CLI_SchemaComposeMutation($input: SchemaComposeInput!) {
    schemaCompose(input: $input) {
      __typename
      ... on SchemaComposeSuccess {
        valid
        compositionResult {
          supergraphSdl
          errors {
            total
            nodes {
              message
            }
          }
        }
      }
      ... on SchemaComposeError {
        message
      }
    }
  }
`);

const ServiceIntrospectionQuery = /* GraphQL */ `
  query ServiceSdlQuery {
    _service {
      sdl
    }
  }
` as unknown as TypedDocumentNode<
  {
    __typename?: 'Query';
    _service: { sdl: string };
  },
  {
    [key: string]: never;
  }
>;

type ServiceName = string;
type Sdl = string;

type ServiceInput = {
  name: ServiceName;
  url: string;
  sdl?: string;
};

type Service = {
  name: ServiceName;
  url: string;
  sdl: Sdl;
};

type ServiceWithSource = {
  name: ServiceName;
  url: string;
  sdl: Sdl;
  input:
    | {
        kind: 'file';
        path: string;
      }
    | {
        kind: 'url';
        url: string;
      };
};

export default class Dev extends Command {
  static description = [
    'Develop and compose Supergraph with service substitution',
    'Only available for Federation projects.',
    'Work in Progress: Please note that this command is still under development and may undergo changes in future releases',
  ].join('\n');
  static flags = {
    'registry.endpoint': Flags.string({
      description: 'registry endpoint',
    }),
    'registry.accessToken': Flags.string({
      description: 'registry access token',
    }),
    service: Flags.string({
      description: 'Service name',
      required: true,
      multiple: true,
      helpValue: '<string>',
    }),
    url: Flags.string({
      description: 'Service url',
      required: true,
      multiple: true,
      helpValue: '<address>',
      dependsOn: ['service'],
    }),
    schema: Flags.string({
      description: 'Service sdl. If not provided, will be introspected from the service',
      multiple: true,
      helpValue: '<filepath>',
      dependsOn: ['service'],
    }),
    watch: Flags.boolean({
      description: 'Watch mode',
      default: false,
    }),
    watchInterval: Flags.integer({
      description: 'Watch interval in milliseconds',
      default: 1000,
    }),
    write: Flags.string({
      description: 'Where to save the supergraph schema file',
      default: 'supergraph.graphql',
    }),
    unstable__forceLatest: Flags.boolean({
      hidden: true,
      description:
        'Force the command to use the latest version of the CLI, not the latest composable version.',
      default: false,
    }),
  };

  async run() {
    const { flags } = await this.parse(Dev);

    const registry = this.ensure({
      key: 'registry.endpoint',
      args: flags,
      defaultValue: graphqlEndpoint,
      env: 'HIVE_REGISTRY',
    });
    const token = this.ensure({
      key: 'registry.accessToken',
      args: flags,
      env: 'HIVE_TOKEN',
    });
    const { unstable__forceLatest } = flags;

    if (flags.service.length !== flags.url.length) {
      this.error('Not every services has a matching url', {
        exit: 1,
      });
    }

    const serviceInputs = flags.service.map((name, i) => {
      const url = flags.url[i];
      const sdl = flags.schema ? flags.schema[i] : undefined;

      return {
        name,
        url,
        sdl,
      };
    });

    if (flags.watch === true) {
      void this.watch(flags.watchInterval, serviceInputs, services =>
        this.compose({
          services,
          registry,
          token,
          write: flags.write,
          unstable__forceLatest,
          onError: message => {
            this.fail(message);
          },
        }),
      );
      return;
    }

    const services = await this.resolveServices(serviceInputs);

    return this.compose({
      services,
      registry,
      token,
      write: flags.write,
      unstable__forceLatest,
      onError: message => {
        this.error(message, {
          exit: 1,
        });
      },
    });
  }

  private async compose(input: {
    services: Array<{
      name: string;
      url: string;
      sdl: string;
    }>;
    registry: string;
    token: string;
    write: string;
    unstable__forceLatest: boolean;
    onError: (message: string) => void | never;
  }) {
    const result = await this.registryApi(input.registry, input.token)
      .request(CLI_SchemaComposeMutation, {
        input: {
          useLatestComposableVersion: !input.unstable__forceLatest,
          services: input.services.map(service => ({
            name: service.name,
            url: service.url,
            sdl: service.sdl,
          })),
        },
      })
      .catch(error => {
        this.handleFetchError(error);
      });

    if (result.schemaCompose.__typename === 'SchemaComposeError') {
      input.onError(result.schemaCompose.message);
      return;
    }

    const { valid, compositionResult } = result.schemaCompose;

    if (!valid) {
      if (compositionResult.errors) {
        renderErrors.call(this, compositionResult.errors);
      }

      input.onError('Composition failed');
      return;
    }

    if (typeof compositionResult.supergraphSdl !== 'string') {
      input.onError(
        'Composition successful but failed to get supergraph schema. Please try again later or contact support',
      );
      return;
    }

    this.success('Composition successful');
    this.log(`Saving supergraph schema to ${input.write}`);
    await writeFile(resolve(process.cwd(), input.write), compositionResult.supergraphSdl, 'utf-8');
  }

  private async watch(
    watchInterval: number,
    serviceInputs: ServiceInput[],
    compose: (services: Service[]) => Promise<void>,
  ) {
    this.info('Watch mode enabled');

    let services = await this.resolveServices(serviceInputs);
    await compose(services);

    this.info('Watching for changes');

    let resolveWatchMode: () => void;

    const watchPromise = new Promise<void>(resolve => {
      resolveWatchMode = resolve;
    });

    let timeoutId: ReturnType<typeof setTimeout>;
    const watch = async () => {
      try {
        const newServices = await this.resolveServices(serviceInputs);
        if (
          newServices.some(
            service => services.find(s => s.name === service.name)!.sdl !== service.sdl,
          )
        ) {
          this.info('Detected changes, recomposing');
          await compose(newServices);
          services = newServices;
        }
      } catch (error) {
        this.fail(String(error));
      }

      timeoutId = setTimeout(watch, watchInterval);
    };

    process.once('SIGINT', () => {
      this.info('Exiting watch mode');
      clearTimeout(timeoutId);
      resolveWatchMode();
    });

    process.once('SIGTERM', () => {
      this.info('Exiting watch mode');
      clearTimeout(timeoutId);
      resolveWatchMode();
    });

    void watch();

    return watchPromise;
  }

  private async resolveServices(services: ServiceInput[]): Promise<Array<ServiceWithSource>> {
    return await Promise.all(
      services.map(async input => {
        if (input.sdl) {
          return {
            name: input.name,
            url: input.url,
            sdl: await this.resolveSdlFromPath(input.sdl),
            input: {
              kind: 'file' as const,
              path: input.sdl,
            },
          };
        }

        return {
          name: input.name,
          url: input.url,
          sdl: await this.resolveSdlFromUrl(input.url),
          input: {
            kind: 'url' as const,
            url: input.url,
          },
        };
      }),
    );
  }

  private async resolveSdlFromPath(path: string) {
    const sdl = await loadSchema(path);
    invariant(typeof sdl === 'string' && sdl.length > 0, `Read empty schema from ${path}`);

    return sdl;
  }

  private async resolveSdlFromUrl(url: string) {
    const result = await this.graphql(url)
      .request(ServiceIntrospectionQuery)
      .catch(error => {
        this.handleFetchError(error);
      });

    const sdl = result._service.sdl;

    if (!sdl) {
      throw new Error('Failed to introspect service');
    }

    return sdl;
  }
}
