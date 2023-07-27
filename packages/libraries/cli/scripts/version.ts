import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

const version = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8')).version;

const code = await readFile(join(__dirname, '..', 'src', 'version.ts'), 'utf-8');

if (!code.includes(`'${version}'`)) {
  await writeFile(
    join(__dirname, '..', 'src', 'version.ts'),
    code.replace(/export const version = .*/, `export const version = '${version}';`),
    'utf-8',
  );
}
