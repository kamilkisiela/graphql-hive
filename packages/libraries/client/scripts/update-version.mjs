import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const code = `export const version = '${pkg.version}';\n`;

fs.writeFileSync(join(__dirname, '../src/version.ts'), code);
