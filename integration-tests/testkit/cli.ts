import { resolve } from 'path';
import { execaCommand } from '@esm2cjs/execa';
import { getServiceHost } from './utils';

const binPath = resolve(__dirname, '../../packages/libraries/cli/bin/run');
const cliDir = resolve(__dirname, '../../packages/libraries/cli');

async function exec(cmd: string) {
  const outout = await execaCommand(`${binPath} ${cmd}`, {
    shell: true,
    env: {
      OCLIF_CLI_CUSTOM_PATH: cliDir,
    },
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
