import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config({
  debug: true,
});

const privateKeyFile = join(process.cwd(), 'github-app.pem');
if (existsSync(privateKeyFile)) {
  // eslint-disable-next-line no-process-env
  process.env.INTEGRATION_GITHUB_APP_PRIVATE_KEY = readFileSync(privateKeyFile, 'utf8');
}

await import('./index');
