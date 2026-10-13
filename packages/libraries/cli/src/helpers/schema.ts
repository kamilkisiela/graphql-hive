import { statSync } from 'node:fs';
import { concatAST, GraphQLError, parse, print, stripIgnoredCharacters } from 'graphql';
import { LegacyLogger } from '@graphql-hive/core/typings/client/types';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { loadTypedefs } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import type { BaseLoaderOptions, Loader, Source } from '@graphql-tools/utils';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { FragmentType, graphql, useFragment as unmaskFragment, useFragment } from '../gql';
import { SeverityLevelType } from '../gql/graphql';
import {
  APIError,
  HiveCLIError,
  IntrospectionError,
  InvalidFederationSubgraphError,
  InvalidSDLError,
  isAggregateError,
  SchemaFileEmptyError,
  SchemaFileNotFoundError,
} from './errors';
import { graphqlRequest } from './graphql-request';
import { Texture } from './texture/texture';

const severityLevelMap: Record<SeverityLevelType, string> = {
  [SeverityLevelType.Breaking]: Texture.colors.red('-'),
  [SeverityLevelType.Safe]: Texture.colors.green('-'),
  [SeverityLevelType.Dangerous]: Texture.colors.green('-'),
};

export const RenderErrors_SchemaErrorConnectionFragment = graphql(`
  fragment RenderErrors_SchemaErrorConnectionFragment on SchemaErrorConnection {
    edges {
      node {
        message
      }
    }
  }
`);

export const renderErrors = (
  errors: FragmentType<typeof RenderErrors_SchemaErrorConnectionFragment>,
) => {
  const e = useFragment(RenderErrors_SchemaErrorConnectionFragment, errors);
  const t = Texture.createBuilder();
  t.failure(`Detected ${e.edges.length} error${e.edges.length > 1 ? 's' : ''}`);
  t.line();
  e.edges.forEach(edge => {
    t.indent(Texture.colors.red('-') + ' ' + Texture.boldQuotedWords(edge.node.message));
  });
  return t.state.value;
};

export const RenderChanges_SchemaChanges = graphql(`
  fragment RenderChanges_schemaChanges on SchemaChangeConnection {
    edges {
      node {
        severityLevel
        isSafeBasedOnUsage
        message(withSafeBasedOnUsageNote: false)
        approval {
          approvedBy {
            displayName
          }
        }
        affectedAppDeployments(first: 0) {
          totalCount
        }
      }
    }
  }
`);

export const renderChanges = (maskedChanges: FragmentType<typeof RenderChanges_SchemaChanges>) => {
  const t = Texture.createBuilder();
  const changes = unmaskFragment(RenderChanges_SchemaChanges, maskedChanges);
  type ChangeType = (typeof changes)['edges'][number]['node'];

  const writeChanges = (changes: ChangeType[]) => {
    changes.forEach(change => {
      const messageParts = [
        severityLevelMap[change.isSafeBasedOnUsage ? SeverityLevelType.Safe : change.severityLevel],
        Texture.boldQuotedWords(change.message),
      ];

      if (change.isSafeBasedOnUsage) {
        messageParts.push(Texture.colors.green('(Safe based on usage ✓)'));
      }
      if (change.approval) {
        messageParts.push(
          Texture.colors.green(
            `(Approved by ${change.approval.approvedBy?.displayName ?? '<unknown>'} ✓)`,
          ),
        );
      }
      if (change.affectedAppDeployments?.totalCount) {
        const count = change.affectedAppDeployments.totalCount;
        messageParts.push(
          Texture.colors.yellow(`[${count} app deployment${count !== 1 ? 's' : ''} affected]`),
        );
      }

      t.indent(messageParts.join(' '));
    });
  };

  t.info(`Detected ${changes.edges.length} change${changes.edges.length > 1 ? 's' : ''}`);
  t.line();

  const breakingChanges = changes.edges.filter(
    edge => edge.node.severityLevel === SeverityLevelType.Breaking,
  );
  const dangerousChanges = changes.edges.filter(
    edge => edge.node.severityLevel === SeverityLevelType.Dangerous,
  );
  const safeChanges = changes.edges.filter(
    edge => edge.node.severityLevel === SeverityLevelType.Safe,
  );

  const otherChanges = changes.edges.filter(
    edge => !Object.values(SeverityLevelType).includes(edge.node.severityLevel),
  );

  if (breakingChanges.length) {
    t.indent(`Breaking changes:`);
    writeChanges(breakingChanges.map(edge => edge.node));
  }

  if (dangerousChanges.length) {
    t.indent(`Dangerous changes:`);
    writeChanges(dangerousChanges.map(edge => edge.node));
  }

  if (safeChanges.length) {
    t.indent(`Safe changes:`);
    writeChanges(safeChanges.map(edge => edge.node));
  }

  // For backwards compatibility in case more severity levels are added.
  // This is unlikely to happen.
  if (otherChanges.length) {
    t.indent(`Other changes: (Current CLI version does not support these SeverityLevels)`);
    writeChanges(otherChanges.map(edge => edge.node));
  }

  return t.state.value;
};

export const renderWarnings = (warnings: {
  total: number;
  nodes: {
    message: string;
    source: string | null;
  }[];
}) => {
  const t = Texture.createBuilder();
  t.line();
  t.warning(`Detected ${warnings.total} warning${warnings.total > 1 ? 's' : ''}`);
  t.line();

  warnings.nodes.forEach(warning => {
    const details = [
      warning.source ? `source: ${Texture.boldQuotedWords(warning.source)}` : undefined,
    ]
      .filter(Boolean)
      .join(', ');

    t.indent(`- ${Texture.boldQuotedWords(warning.message)}${details ? ` (${details})` : ''}`);
  });

  return t.state.value;
};

export async function loadSchema(
  /**
   * Behaviour for loading the schema from a HTTP endpoint.
   */
  httpLoadingIntent:
    | 'first-federation-then-graphql-introspection'
    | 'only-graphql-introspection'
    | 'only-federation-introspection'
    | null,
  file: string,
  options: {
    logger: LegacyLogger;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
  },
) {
  const logger = options?.logger;
  const loaders: Loader[] = [];

  if (httpLoadingIntent === 'first-federation-then-graphql-introspection') {
    loaders.unshift(new FederationSubgraphIntrospectionThenGraphQLIntrospectionUrlLoader(logger));
  } else if (httpLoadingIntent === 'only-federation-introspection') {
    loaders.unshift(new FederationSubgraphUrlLoader(logger));
  } else if (httpLoadingIntent === 'only-graphql-introspection') {
    loaders.unshift(new UrlLoader());
  }

  loaders.push(new CodeFileLoader(), new GraphQLFileLoader(), new JsonFileLoader());

  const sources = await loadTypedefs(file, {
    ...options,
    cwd: process.cwd(),
    loaders,
  });

  return print(concatAST(sources.map(s => s.document!)));
}

/**
 * Load the SDL of a schema file, glob or URL, and report failures with the matching CLI error:
 * a missing file, an empty file and invalid SDL each have their own error code.
 */
export async function loadSchemaSdl(
  pointer: string,
  options: {
    logger: LegacyLogger;
    headers?: Record<string, string>;
    httpLoadingIntent?: Parameters<typeof loadSchema>[0];
  },
): Promise<string> {
  const { httpLoadingIntent = 'first-federation-then-graphql-introspection', ...loadOptions } =
    options;
  let rawSdl: string;
  try {
    rawSdl = await loadSchema(httpLoadingIntent, pointer, loadOptions);
  } catch (error) {
    if (error instanceof HiveCLIError) {
      throw error;
    }
    if (isAggregateError(error)) {
      const hiveCliError = error.errors.find(error => error instanceof HiveCLIError);
      if (hiveCliError) {
        throw hiveCliError;
      }

      const maybeGraphQLError: GraphQLError | null =
        error.errors[0]?.name === 'GraphQLError' ? (error.errors[0] as GraphQLError) : null;
      if (maybeGraphQLError) {
        throw new InvalidSDLError(maybeGraphQLError);
      }
    }
    if (isUrlPointer(pointer)) {
      throw new SchemaFileNotFoundError(pointer, error instanceof Error ? error : String(error));
    }
    if (error instanceof Error && error.name === 'NoTypeDefinitionsFound') {
      if (isExistingFile(pointer)) {
        throw new SchemaFileEmptyError(pointer);
      }
      if (isPlainFilePath(pointer)) {
        throw new SchemaFileNotFoundError(pointer, 'The file does not exist.');
      }
    }
    throw new SchemaFileNotFoundError(pointer, error instanceof Error ? error : String(error));
  }

  if (rawSdl.trim().length === 0) {
    throw new SchemaFileEmptyError(pointer);
  }

  return rawSdl;
}

export function isUrlPointer(pointer: string): boolean {
  return /^https?:\/\//.test(pointer);
}

function isPlainFilePath(pointer: string): boolean {
  return !isUrlPointer(pointer) && !/[*?{}[\]!]/.test(pointer);
}

function isExistingFile(pointer: string): boolean {
  if (!isPlainFilePath(pointer)) {
    return false;
  }
  try {
    return statSync(pointer).isFile();
  } catch {
    return false;
  }
}

export function minifySchema(schema: string): string {
  return stripIgnoredCharacters(schema);
}

class FederationSubgraphUrlLoader implements Loader {
  constructor(private logger?: LegacyLogger) {}

  async load(
    pointer: string,
    options?: BaseLoaderOptions & { headers?: Record<string, string> },
  ): Promise<Array<Source>> {
    if (!pointer.startsWith('http://') && !pointer.startsWith('https://')) {
      this.logger?.debug?.('Provided endpoint is not HTTP, skip introspection.');
      return [];
    }

    const client = graphqlRequest({
      logger: this.logger,
      endpoint: pointer,
      additionalHeaders: {
        ...options?.headers,
      },
    });

    try {
      const response = await client.request({
        operation: parse(/* GraphQL */ `
        query ${'GetFederationSchema'} {
          _service {
            sdl
          }
        }
      `) as TypedDocumentNode<{ _service: { sdl: string } }, Record<string, never>>,
      });

      this.logger?.debug?.('Resolved subgraph SDL successfully.');

      const sdl = minifySchema(response._service.sdl);

      return [
        {
          document: parse(sdl),
          rawSDL: sdl,
        },
      ];
    } catch (err) {
      if (
        err instanceof APIError &&
        err.graphQLErrors?.some(
          err =>
            err.message.includes('Cannot query field "_service" on type "Query"') ||
            err.message.includes('Cannot query field "sdl" on type "_Service"'),
        )
      ) {
        throw new InvalidFederationSubgraphError(
          'The GraphQL server responded with the following errors:\n' +
            err.graphQLErrors.map(error => `- ${error.message}`).join('\n'),
        );
      }
      throw err;
    }
  }
}

class FederationSubgraphIntrospectionThenGraphQLIntrospectionUrlLoader implements Loader {
  private urlLoader = new UrlLoader();
  private federationLoader: FederationSubgraphUrlLoader;

  constructor(private logger?: LegacyLogger) {
    this.federationLoader = new FederationSubgraphUrlLoader(logger);
  }

  async load(pointer: string, options: BaseLoaderOptions & { headers?: Record<string, string> }) {
    try {
      return await this.federationLoader.load(pointer, options);
    } catch (e) {
      // if this error is because because federated introspection isnt supported, then ignore and try
      // normal introspection.
      if (!(e instanceof IntrospectionError || e instanceof InvalidFederationSubgraphError)) {
        // otherwise, raise an introspection error because some unknown error happened during introspection.
        // this may be unintuitive, but we don't want to raise an API Error since users may believe our API is the one at fault.
        // We'd rather nudge them to look into their service's behavior.
        throw new IntrospectionError(pointer);
      }
    }

    this.logger?.debug?.('Query._service not found. This is a not a Federation subgraph.');
    return await this.urlLoader.load(pointer, options);
  }
}
