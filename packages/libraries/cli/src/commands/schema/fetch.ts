import { writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { Args, Flags } from '@oclif/core';
import Command from '../../base-command';
import { graphql } from '../../gql';

const SchemaVersionForActionIdQuery = graphql(/* GraphQL */ `
  query SchemaVersionForActionId(
    $actionId: ID!
    $includeSDL: Boolean!
    $includeSupergraph: Boolean!
  ) {
    schemaVersionForActionId(actionId: $actionId) {
      id
      valid
      sdl @include(if: $includeSDL)
      supergraph @include(if: $includeSupergraph)
    }
  }
`);

export default class SchemaFetch extends Command {
  static description = 'fetch schema or supergraph from the Hive API';
  static flags = {
    /** @deprecated */
    registry: Flags.string({
      description: 'registry address',
      deprecated: {
        message: 'use --registry.endpoint instead',
        version: '0.21.0',
      },
    }),
    /** @deprecated */
    token: Flags.string({
      description: 'api token',
      deprecated: {
        message: 'use --registry.accessToken instead',
        version: '0.21.0',
      },
    }),
    'registry.endpoint': Flags.string({
      description: 'registry endpoint',
    }),
    'registry.accessToken': Flags.string({
      description: 'registry access token',
    }),
    type: Flags.string({
      aliases: ['T'],
      description: 'Type to fetch (possible types: sdl, supergraph)',
    }),
    write: Flags.string({
      aliases: ['W'],
      description: 'Write to a file (possible extensions: .graphql, .gql, .gqls, .graphqls)',
    }),
    outputFile: Flags.string({
      description: 'whether to write to a file instead of stdout',
    }),
  };

  static args = {
    service: Args.string({
      name: 'actionId' as const,
      required: true,
      description: 'action id (e.g. commit sha)',
      hidden: false,
    }),
  };

  async run() {
    const { flags, args } = await this.parse(SchemaFetch);

    const endpoint = this.ensure({
      key: 'registry.endpoint',
      args: flags,
      env: 'HIVE_REGISTRY',
    });

    const accessToken = this.ensure({
      key: 'registry.accessToken',
      args: flags,
      env: 'HIVE_TOKEN',
    });

    const actionId: string = args.service;

    const sdlType = this.ensure({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      key: 'type',
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      args: flags,
      defaultValue: 'sdl',
    });

    const result = await this.registryApi(endpoint, accessToken).request(
      SchemaVersionForActionIdQuery,
      {
        actionId,
        includeSDL: sdlType === 'sdl',
        includeSupergraph: sdlType === 'supergraph',
      },
    );

    if (result.schemaVersionForActionId == null) {
      return this.error(`No schema found for action id ${actionId}`);
    }

    if (result.schemaVersionForActionId.valid === false) {
      return this.error(`Schema is invalid for action id ${actionId}`);
    }

    const schema =
      result.schemaVersionForActionId.sdl ?? result.schemaVersionForActionId.supergraph;

    if (schema == null) {
      return this.error(`No ${sdlType} found for action id ${actionId}`);
    }

    if (flags.write) {
      const filepath = resolve(process.cwd(), flags.write);
      switch (extname(flags.write.toLowerCase())) {
        case '.graphql':
        case '.gql':
        case '.gqls':
        case '.graphqls':
          await writeFile(filepath, schema, 'utf8');
          break;
        default:
          this.fail(`Unsupported file extension ${extname(flags.write)}`);
          this.exit(1);
      }
      return;
    }
    this.log(schema);
  }
}
