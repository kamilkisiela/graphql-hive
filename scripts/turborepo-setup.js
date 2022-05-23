/**
 * Create Turborepo config file
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envFile = path.resolve(cwd, '.env');

  if (!fs.existsSync(envFile)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(envFile, 'utf-8'));
}

function main() {
  const configDir = '.turbo';
  const configFile = path.resolve(cwd, configDir, 'config.json');
  const envFile = loadEnv();

  const env = {
    TURBO_API_URL: envFile.TURBO_API_URL || process.env.TURBO_API_URL,
    TURBO_TOKEN: envFile.TURBO_TOKEN || process.env.TURBO_TOKEN,
    TURBO_TEAM: envFile.TURBO_TEAM || process.env.TURBO_TEAM,
  };

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
