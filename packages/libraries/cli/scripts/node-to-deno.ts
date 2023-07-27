import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copy } from 'fs-extra';
import glob from 'glob';

// Deno:
// - requires to use .ts extension everywhere (even in gql/ folder)
// How to run in dev: deno run -A src/index.ts whoami
// How to compile: deno compile -A src/index.ts --no-check --target X
//
// How to automate this?
// 1. Copy all files .ts files to `deno` folder
// 2. Add .ts extension to all local imports in `deno` folder
// 3. Run compilation step for each target: deno compile -A src/index.ts --no-check --target X --out hive-X
// 4. Copy all compiled files to `packages/libraries/cli` folder
// 5. Make sure changeset includes all binaries in the release page.

const startedAt = Date.now();
const __dirname = new URL('.', import.meta.url).pathname;

await copy(join(__dirname, '..', 'src'), join(__dirname, '..', 'deno'));
const files = glob.sync(join(__dirname, '..', 'deno', '**', '*.ts'));
const fromRegex = / from\s+["']{1}(.*)["']{1};/gm;

function convertFromStatement(from: string, importStatement: string, filepath: string) {
  if (!from.startsWith('.')) {
    // not a local import
    return importStatement;
  }

  if (from.endsWith('/gql') && !filepath.endsWith('gql/index.ts')) {
    from += '/index';
  }

  return ` from '${from}.ts';`;
}

async function convertFile(filepath: string) {
  if (filepath.endsWith('helpers/process.ts')) {
    const code = await readFile(filepath, 'utf-8');
    const lines = code.split('\n');

    let startsAt: number | null = null;
    let endsAt: number | null = null;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (line.includes('importRequiredModules')) {
        startsAt = lineIndex;
      }

      if (line.includes('@deno/shim-deno')) {
        lines[lineIndex] = '// Removed: @deno/shim-deno';
      }

      if (startsAt !== null && endsAt === null && line.trim() === '}') {
        endsAt = lineIndex;
        break;
      }
    }

    if (startsAt && endsAt) {
      const before = lines.slice(0, startsAt + 1);
      const after = lines.slice(endsAt);

      await writeFile(
        filepath,
        before
          .concat(
            'return Promise.reject(new Error("--require is only available in @graphql-hive/cli"));',
            after,
          )
          .join('\n'),
        'utf-8',
      );
    }
  }

  const code = await readFile(filepath, 'utf-8');

  const newCode = code.replace(fromRegex, (match, from) =>
    convertFromStatement(from, match, filepath),
  );

  await writeFile(filepath, newCode, 'utf-8');
}

for await (const file of files) {
  await convertFile(file);
}

console.log('Done', 'in', Date.now() - startedAt, 'ms');
