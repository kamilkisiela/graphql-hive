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
    js: `
      // Adds missing require function (reason: node_modules are not transpiled)
      import { createRequire as _createRequire } from 'module';
      const require = _createRequire(import.meta.url);        
    `,
  },
});
