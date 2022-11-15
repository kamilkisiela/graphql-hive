import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

(async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const localBuild = !!process.env.BUILD_FOR_LOCAL;
  const outfile = localBuild ? '/dist/dev.js' : '/dist/worker.js';

  await build({
    entryPoints: [__dirname + (localBuild ? '/src/dev.ts' : '/src/index.ts')],
    bundle: true,
    platform: localBuild ? 'node' : 'browser',
    target: localBuild ? undefined : 'chrome95',
    minify: false,
    outfile: __dirname + '/' + outfile,
    treeShaking: true,
  });

  console.info(`Done, file: ${outfile}`);
})();
