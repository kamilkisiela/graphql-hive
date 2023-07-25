import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';

//
// Make sure we support only IPv4
// See: https://github.com/kamilkisiela/graphql-hive/issues/2572
//

const FORBIDDEN_IPS = ['localhost', '::'];
const ALLOWED_IP = '0.0.0.0';
// These env vars point to 3rd party services running in Docker
const IGNORED_ENV_VARS = [
  'CLICKHOUSE_HOST', // ClickHouse
  'POSTGRES_HOST', // PG
  'SUPERTOKENS_CONNECTION_URI', // SuperTokens
  'S3_ENDPOINT', // Minio
  'S3_PUBLIC_URL', // Minio
  'REDIS_HOST', // Redis
  'KAFKA_BROKER', // Kafka/Redpanda
];

const envTemplatePaths = await fg('**/.env.template', {
  cwd: process.cwd(),
  ignore: ['**/node_modules'],
});

const errors: Array<{
  key: string;
  path: string;
  before: string;
  after: string;
}> = [];

// Check .env files as well
// Auto-migrate to ALLOWED_IP

for (const envPath of envTemplatePaths) {
  const file = await readFile(envPath, 'utf8');
  const entry = file
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(keyValue => {
      const [key, value] = keyValue.split('=');
      return [key, value.match(/(["'])((?:\1|.)*?)\1/)?.[2] || value];
    });

  for (const [key, value] of entry) {
    if (IGNORED_ENV_VARS.includes(key)) {
      continue;
    }

    const forbiddenIp = FORBIDDEN_IPS.filter(ip => value.includes(ip));
    if (forbiddenIp.length) {
      errors.push({
        key,
        path: envPath,
        before: value,
        after: value.replace(forbiddenIp[0], ALLOWED_IP),
      });
    }
  }
}

if (errors.length) {
  throw new Error(
    'Invalid IP address found in .env.template files.\n' +
      '\n\n' +
      errors
        .map(({ key, path, before, after }) =>
          [
            `- "${key}" in ${path}.`,
            `  Use "${ALLOWED_IP}" to make it compatible with both IPv4 and IPv6.`,
            `  Replace: ${before} by ${after}`,
          ].join('\n'),
        )
        .join('\n\n'),
  );
}
