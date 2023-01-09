import { promises as fs } from 'fs';
import { relative } from 'path';
import { normalizeOperation } from '@graphql-hive/core';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadDocuments } from '@graphql-tools/load';
import { parse } from 'graphql';

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

  const cwd = process.cwd();
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
