import * as fs from 'fs/promises';
import * as path from 'path';
import * as url from 'url';
import graphql, { Kind, visit } from 'graphql';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

const persistedOperationsAppPath = path.join(
  dirname,
  '..',
  '..',
  '..',
  'web',
  'app',
  'src',
  'gql',
  'persisted-documents.json',
);
const persistedOperationsDistPath = path.join(dirname, '..', 'dist', 'persisted-documents.json');

const persistedOperations: Record<string, string> = JSON.parse(
  await fs.readFile(persistedOperationsAppPath, 'utf-8'),
);

await fs.writeFile(
  persistedOperationsDistPath,
  JSON.stringify(
    Object.fromEntries(
      Object.entries(persistedOperations).map(([key, value]) => [
        key,
        // Note:
        // We manually add the __typename field to all queries to make sure that we don't break urql's cache.
        // This should probably happen during the code generation process
        visit(graphql.parse(value), {
          SelectionSet(node) {
            if (
              !node.selections.find(
                selection => selection.kind === 'Field' && selection.name.value === '__typename',
              )
            ) {
              return {
                ...node,
                selections: [
                  {
                    kind: Kind.FIELD,
                    name: {
                      kind: Kind.NAME,
                      value: '__typename',
                    },
                  },
                  ...node.selections,
                ],
              };
            }
          },
        }),
      ]),
    ),
    null,
    2,
  ),
);
