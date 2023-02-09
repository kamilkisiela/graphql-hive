import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';

const FORBIDDEN_IP = '0.0.0.0'
const ALLOWED_IP = 'localhost'

const envTemplatePaths = await fg('**/.env.template', {
  cwd: process.cwd(),
  ignore: ['**/node_modules'],
});

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
    if (value.includes(FORBIDDEN_IP)) {
      throw new Error(`Error while validating "${key}" in ${envPath}.

Use "${ALLOWED_IP}" to make it compatible with both IPv4 and IPv6.

Replace: ${value} by ${value.replace(FORBIDDEN_IP, ALLOWED_IP)}
`);
    }
  }
}
