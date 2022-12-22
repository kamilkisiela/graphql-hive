import { resolve } from 'path';
import { getServiceHost } from './utils';
import { execaCommand } from '@esm2cjs/execa';

const binPath = resolve(__dirname, '../../packages/libraries/cli/bin/dev');

async function exec(cmd: string) {
  const outout = await execaCommand(`${binPath} ${cmd}`, {
    shell: true,
  });

  if (outout.failed) {
    throw new Error(outout.stderr);
  }

  return outout.stdout;
}

export async function schemaPublish(args: string[]) {
  const registryAddress = await getServiceHost('server', 8082);
  return await exec(
    ['schema:publish', `--registry`, `http://${registryAddress}/graphql`, ...args].join(' '),
  );
}

export async function schemaCheck(args: string[]) {
  const registryAddress = await getServiceHost('server', 8082);

  return await exec(
    ['schema:check', `--registry`, `http://${registryAddress}/graphql`, ...args].join(' '),
  );
}
