import * as utils from 'dockest/test-helper';
import { execa } from 'dockest';
import { resolve } from 'path';

const registryAddress = utils.getServiceAddress('server', 3001);
const cliDevLocation = resolve(__dirname, '../../packages/libraries/cli/bin/dev');

async function exec(cmd: string) {
  const result = execa(`${cliDevLocation} ${cmd}`);

  if (result.failed) {
    throw result.stderr;
  }

  return result.stdout;
}

export async function schemaPublish(args: string[]) {
  return exec(['schema:publish', `--registry`, `http://${registryAddress}/graphql`, ...args].join(' '));
}

export async function schemaCheck(args: string[]) {
  return exec(['schema:check', `--registry`, `http://${registryAddress}/graphql`, ...args].join(' '));
}
