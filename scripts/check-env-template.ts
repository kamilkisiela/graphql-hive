import { readFile, writeFile } from 'node:fs/promises';
import fg from 'fast-glob';

//
// Make sure we support only IPv4
// See: https://github.com/kamilkisiela/graphql-hive/issues/2572
//

// Auto-fix mode:
//  $ pnpm lint:env-template --fix
const fix = process.argv.includes('--fix');

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

const envPaths = await fg(['**/.env.template', '**/.env'], {
  cwd: process.cwd(),
  ignore: ['**/node_modules'],
});

const errors: Array<{
  key: string;
  path: string;
  before: string;
  after: string;
}> = [];

const warnings: Array<{
  key: string;
  path: string;
  before: string;
  after: string;
}> = [];

for (const envPath of envPaths) {
  const file = await readFile(envPath, 'utf8');
  const lines = file.split('\n');
  const entries = lines.map(line => {
    if (!line || line.startsWith('#')) {
      return [null, null] as const;
    }

    const [key, value] = line.split('=');
    return [key, value.match(/(["'])((?:\1|.)*?)\1/)?.[2] || value] as const;
  });

  const linesToFix: Array<{
    key: string;
    value: string;
    line: number;
  }> = [];

  for (let line = 0; line < entries.length; line++) {
    const [key, value] = entries[line];
    if (!key || !value) {
      continue;
    }

    if (IGNORED_ENV_VARS.includes(key)) {
      continue;
    }

    const forbiddenIp = FORBIDDEN_IPS.filter(ip => value.includes(ip));
    if (forbiddenIp.length) {
      if (fix) {
        const newValue = value.replace(forbiddenIp[0], ALLOWED_IP);
        linesToFix.push({ key, value: newValue, line });
        warnings.push({
          key,
          path: envPath + ':' + (line + 1),
          before: value,
          after: newValue,
        });
      } else {
        errors.push({
          key,
          path: envPath + ':' + (line + 1),
          before: value,
          after: value.replace(forbiddenIp[0], ALLOWED_IP),
        });
      }
    }
  }

  if (linesToFix.length) {
    linesToFix.forEach(({ key, value, line }) => {
      lines[line] = `${key}=${value}`;
    });
    await writeFile(envPath, lines.join('\n'), 'utf-8');
  }
}

if (errors.length) {
  console.error(
    'Invalid IP addresses found in .env.template and .env files.\n\n' +
      'Use "0.0.0.0" to make it compatible with both IPv4 and IPv6.\n' +
      '\n\n' +
      errors
        .map(({ key, path, before, after }) =>
          [`❌ ${key} in ${path}`, `  Replace "${before}" with "${after}"`].join('\n'),
        )
        .join('\n\n'),
  );
  process.exit(1);
}

if (warnings.length) {
  console.info(
    'Fixed invalid IP addresses found in .env.template files.\n' +
      '\n\n' +
      warnings
        .map(({ key, path, before, after }) =>
          [`🧹 ${path}`, `  "${key}" = "${before}" => "${after}"`].join('\n'),
        )
        .join('\n\n'),
  );
}
