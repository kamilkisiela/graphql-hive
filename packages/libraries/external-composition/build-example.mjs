/* eslint-disable */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { build as tsup } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

await tsup({
  entry: [join(__dirname, 'example.mjs')],
  outDir: join(__dirname, 'dist'),
  target: 'node18',
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  shims: false,
  skipNodeModulesBundle: false,
  noExternal: Object.keys(pkg.peerDependencies).concat(Object.keys(pkg.devDependencies)),
  banner: {
    js: "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
  },
});
