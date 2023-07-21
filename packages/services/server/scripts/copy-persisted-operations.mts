import * as fs from 'fs/promises';
import * as path from 'path';
import * as url from 'url';
import graphql from 'graphql';

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
      Object.entries(persistedOperations).map(([key, value]) => [key, graphql.parse(value)]),
    ),
    null,
    2,
  ),
);
