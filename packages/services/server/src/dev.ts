import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

config({
  debug: true,
});

const privateKeyFile = join(process.cwd(), 'github-app.pem');

if (existsSync(privateKeyFile)) {
  // eslint-disable-next-line no-process-env
  process.env.GITHUB_APP_PRIVATE_KEY = readFileSync(privateKeyFile, 'utf8');
}

await import('./index');
