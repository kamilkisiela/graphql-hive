import { config } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

config({
  debug: true,
});

const privateKeyFile = join(process.cwd(), 'github-app.pem');

if (existsSync(privateKeyFile)) {
  process.env.GITHUB_APP_PRIVATE_KEY = readFileSync(privateKeyFile, 'utf8');
}

await import('./index');
