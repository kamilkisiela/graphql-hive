import { promises as fs } from 'fs';
import { relative } from 'path';
import { parse } from 'graphql';
import { normalizeOperation } from '@graphql-hive/core';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadDocuments } from '@graphql-tools/load';

export async function loadOperations(
  file: string,
  options?: {
    normalize?: boolean;
    pluckModules?:
      | {
          name: string;
          identifier?: string;
        }[];
    pluckGlobalGqlIdentifierName?: string[];
  },
): Promise<
  Array<{
    operationHash?: string;
    content: string;
    location?: string;
  }>
> {
  const shouldNormalize = options?.normalize ?? true;
  const pluckModules = options?.pluckModules;
  const pluckGlobalGqlIdentifierName = options?.pluckGlobalGqlIdentifierName;

  if (file.toLowerCase().endsWith('.json')) {
    const output: Record<string, string> = JSON.parse(await fs.readFile(file, 'utf8'));

    const operations: Array<{
      operationHash: string;
      content: string;
      location?: string;
    }> = [];

    for (const operationHash in output) {
      const content = output[operationHash];
      const doc = parse(content);

      operations.push({
        operationHash,
        content: shouldNormalize
          ? normalizeOperation({
              document: doc,
              hideLiterals: true,
              removeAliases: true,
            })
          : content,
      });
    }

    return operations;
  }

  const cwd = process.cwd();
  const sources = await loadDocuments(file, {
    cwd,
    loaders: [
      new CodeFileLoader({
        pluckConfig: {
          modules: pluckModules,
          globalGqlIdentifierName: pluckGlobalGqlIdentifierName,
        },
      }),
      new GraphQLFileLoader(),
    ],
  });

  return sources.map(source => ({
    content: normalizeOperation({
      document: source.document!,
      hideLiterals: false,
      removeAliases: false,
    }),
    location: source.location ? relative(cwd, source.location) : undefined,
  }));
}
