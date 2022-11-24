/**
 * The goal here is to sync the .env file with the .env.template file, in every package.
 * <sync> is a special value that will be replaced with the value from the root .env file.
 */
import { constants } from 'fs';
import { readFile, writeFile, access } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { parse } from 'dotenv';
import glob from 'glob';

if (!!process.env.CI) {
  console.log('[sync-env-files] CI Detected, skipping');
  process.exit(0);
}

const cwd = process.cwd();

async function main() {
  console.log('[sync-env-files] Syncing');

  const [localFiles, rootEnv] = await Promise.all([findLocalEnvFiles(), loadRootEnv()]);

  async function syncEnvFile(envLocalFile) {
    const dir = dirname(envLocalFile);
    const envFile = join(dir, '.env');

    if (!(await exists(envFile))) {
      console.log('[sync-env-files] Write .env file in', relative(process.cwd(), dir));
      await writeFile(envFile, await readFile(envLocalFile));
    }

    // compare the contents of the local file and the env file
    const [localFileContents, envFileContents] = await Promise.all([
      readFile(envLocalFile, 'utf8'),
      readFile(envFile, 'utf8'),
    ]);

    const localEnv = parse(localFileContents);
    const env = parse(envFileContents);

    let modified = false;

    for (const [key, value] of Object.entries(localEnv)) {
      if (!(key in env)) {
        modified = true;
        env[key] = value;
      }

      if (env[key] === '<sync>' || env[key] === '') {
        modified = true;
        env[key] = typeof rootEnv[key] !== 'undefined' ? rootEnv[key] : process.env[key];
      }
    }

    if (modified) {
      console.log('[sync-env-files] Sync', relative(process.cwd(), envFile));
      await writeFile(envFile, stringifyDotEnv(env), 'utf8');
    }
  }

  await Promise.all(localFiles.map(syncEnvFile));

  console.log('[sync-env-files] Synced');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<string[]>}
 */
function findLocalEnvFiles() {
  return new Promise((resolve, reject) => {
    glob(
      '{packages/**/*/.env.template,integration-tests/.env.template}',
      {
        ignore: ['**/node_modules/**', '**/dist/**'],
        cwd,
      },
      (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      },
    );
  });
}

async function loadRootEnv() {
  const rootEnvFile = join(cwd, '.env');
  return (await exists(rootEnvFile)) ? parse(await readFile(rootEnvFile, 'utf8')) : {};
}

function stringifyDotEnv(obj) {
  const quote = /[\s"']/;

  if (typeof obj !== 'object') {
    throw new Error('stringify() expects an object');
  }

  return Object.keys(obj)
    .map(key => {
      const val = obj[key];

      let str = '';

      switch (typeof val) {
        case 'string':
          try {
            JSON.parse(val);
            str = val;
          } catch (e) {
            str = quote.test(val) ? JSON.stringify(val) : val;
          }
          break;

        case 'boolean':
        case 'number':
          str = String(val);
          break;

        case 'undefined':
          str = '';
          break;

        case 'object':
          if (val !== null) {
            str = JSON.stringify(val);
          }
          break;
      }

      return `${key}=${str}`;
    })
    .join('\n');
}
