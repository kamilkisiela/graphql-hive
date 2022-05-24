import * as utils from 'dockest/test-helper';
import { run } from '../../packages/libraries/cli/src/index';

const registryAddress = utils.getServiceAddress('server', 3001);

export async function schemaPublish(args: string[]) {
  return run(['schema:publish', `--registry`, `http://${registryAddress}/graphql`, ...args]);
}

export async function schemaCheck(args: string[]) {
  return run(['schema:check', `--registry`, `http://${registryAddress}/graphql`, ...args]);
}
