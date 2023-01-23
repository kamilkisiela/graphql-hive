/* eslint-disable no-undef, @typescript-eslint/no-floating-promises */
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

(async function main() {
  console.log('🚀 Building Hive Police Worker...');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const workerOutputPath = `${__dirname}/dist/index.worker.js`;

  await Promise.all([
    // Build for CloudFlare Worker environment
    build({
      entryPoints: [`${__dirname}/src/index.ts`],
      bundle: true,
      platform: 'browser',
      target: 'chrome95',
      minify: false,
      outfile: workerOutputPath,
      treeShaking: true,
    }).then(result => {
      console.log(`✅ Built for CloudFlare Worker: "${workerOutputPath}"`);
      return result;
    }),
  ]);
})();
