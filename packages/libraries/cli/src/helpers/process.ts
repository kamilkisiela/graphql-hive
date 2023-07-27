import { Deno } from '@deno/shim-deno';

export const processEnv = Deno.env.toObject();
export const processCwd = Deno.cwd();
export const processExit = Deno.exit;
export const processArgs = Deno.args;

export function importRequiredModules(modules: string[]) {
  return Promise.all(modules.map(mod => import(require.resolve(mod, { paths: [processCwd] }))));
}
