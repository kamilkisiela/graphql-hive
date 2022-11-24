/**
 * !! Node !!
 *
 * Gets all the packages from the manifest and packs them.
 * As a result, we get a tarball for each package in the integration-tests/tarballs directory.
 *
 * Naming convention:
 *  @hive/tokens -> tokens.tgz
 */

import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';
import glob from 'glob';
import rimraf from 'rimraf';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.resolve(__dirname, '../..');
const tarballDir = path.resolve(cwd, 'integration-tests/tarballs');

async function main() {
  rimraf.sync(`${tarballDir}`, {});
  fsExtra.mkdirSync(tarballDir, { recursive: true });

  function isBackendPackage(manifestPath) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')).buildOptions?.tags.includes(
      'backend',
    );
  }

  function listBackendPackages() {
    const manifestPathCollection = glob.sync('packages/services/cdn-worker/package.json', {
      cwd,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    return manifestPathCollection
      .filter(isBackendPackage)
      .map(filepath => path.relative(cwd, path.dirname(filepath)));
  }

  async function pack(location) {
    const { version, name } = JSON.parse(
      await fsExtra.readFile(path.join(cwd, location, 'package.json'), 'utf-8'),
    );
    const stdout = await new Promise((resolve, reject) => {
      exec(
        `npm pack ${path.join(cwd, location, 'dist')}`,
        {
          cwd,
          encoding: 'utf8',
        },
        (err, stdout, stderr) => {
          console.log(stderr);
          if (err) {
            reject(err);
          } else {
            resolve(stdout);
          }
        },
      );
    });

    const lines = stdout.split('\n');
    const sourceFilename = lines[lines.length - 2];
    const sourceFilePath = path.resolve(cwd, sourceFilename);
    const targetFilename = sourceFilename.replace('hive-', '').replace(`-${version}`, '');
    const targetFilePath = path.join(tarballDir, targetFilename);

    if (/-\d+\.\d+\.\d+\.tgz$/.test(targetFilePath)) {
      throw new Error(`Build ${name} package first!`);
    }

    await fsExtra.rename(sourceFilePath, targetFilePath);

    return targetFilePath;
  }

  const locations = listBackendPackages();

  await Promise.all(
    locations.map(async loc => {
      try {
        const filename = await pack(loc);

        console.log('[pack] Done', path.resolve(cwd, filename));
      } catch (error) {
        console.error(`[pack] Failed to pack ${loc}: ${error}`);
        console.error('[pack] Maybe you forgot to build the packages first?');
        process.exit(1);
      }
    }),
  );
}

await main();
