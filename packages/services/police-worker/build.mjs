import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

(async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outfile = '/dist/worker.js';

  await build({
    entryPoints: [__dirname + '/src/index.ts'],
    bundle: true,
    platform: 'browser',
    target: 'chrome95',
    minify: false,
    outfile: __dirname + '/' + outfile,
    treeShaking: true,
  });

  console.info(`Done, file: ${outfile}`);
})();
