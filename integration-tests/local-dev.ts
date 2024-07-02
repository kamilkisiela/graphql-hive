import { parse } from 'dotenv';
import { readFileSync } from 'fs';

function applyEnv(env: Record<string, string>) {
  for (const key in env) {
    process.env[key] = env[key];
  }
}

const serverEnvVars = parse(readFileSync('../packages/services/server/.env', 'utf-8'));

applyEnv({
  SUPERTOKENS_CONNECTION_URI: serverEnvVars.SUPERTOKENS_CONNECTION_URI,
  SUPERTOKENS_API_KEY: serverEnvVars.SUPERTOKENS_API_KEY,
  POSTGRES_USER: serverEnvVars.POSTGRES_USER,
  POSTGRES_PASSWORD: serverEnvVars.POSTGRES_PASSWORD,
  POSTGRES_DB: serverEnvVars.POSTGRES_DB,
  POSTGRES_PORT: serverEnvVars.POSTGRES_PORT,
  POSTGRES_HOST: serverEnvVars.POSTGRES_HOST,
  HIVE_APP_BASE_URL: serverEnvVars.WEB_APP_URL,
  EXTERNAL_COMPOSITION_SECRET: 'secretsecret',
  CLICKHOUSE_USER: serverEnvVars.CLICKHOUSE_USERNAME,
  CLICKHOUSE_PASSWORD: serverEnvVars.CLICKHOUSE_PASSWORD,
})