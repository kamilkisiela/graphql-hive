import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const packageJsonAt = join(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(packageJsonAt, 'utf-8'));
const code = `export const version = '${pkg.version}';\n`;
const versionFileAt = join(process.cwd(), 'src/version.ts');

writeFileSync(versionFileAt, code);

console.log('Generated version file successfully at', versionFileAt);
