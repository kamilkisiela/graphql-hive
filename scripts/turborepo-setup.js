/**
 * Create Turborepo config file
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const configDir = '.turbo';
  const configFile = path.resolve(cwd, configDir, 'config.json');
  const envFile = path.resolve(cwd, '.env');

  if (!fs.existsSync(envFile)) {
    console.log('[turborepo-setup] No .env file found. Skipping.');
    return;
  }

  const env = dotenv.parse(fs.readFileSync(envFile, 'utf-8'));

  if (!env.TURBO_API_URL || !env.TURBO_TOKEN || !env.TURBO_TEAM) {
    console.log(
      '[turborepo-setup] No TURBO_API_URL, TURBO_TOKEN or TURBO_TEAM found. Skipping.'
    );
    return;
  }

  fs.writeFileSync(
    configFile,
    JSON.stringify(
      {
        teamId: '_',
        apiUrl: env.TURBO_API_URL,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log('[turborepo-setup] Config created.');
}

main();
