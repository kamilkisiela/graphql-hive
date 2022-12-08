import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

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
