import { promises as fs } from 'node:fs';
import { relative } from 'node:path';
import { parse } from 'graphql';
import { normalizeOperation } from '@graphql-hive/core';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadDocuments } from '@graphql-tools/load';
import { processCwd } from './process';

export async function loadOperations(
  file: string,
  options?: {
    normalize?: boolean;
  },
): Promise<
  Array<{
    operationHash?: string;
    content: string;
    location?: string;
  }>
> {
  const shouldNormalize = options?.normalize ?? true;

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

  const cwd = processCwd;
  const sources = await loadDocuments(file, {
    cwd,
    loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
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
