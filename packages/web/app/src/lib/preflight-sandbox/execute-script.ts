import CryptoJS from 'crypto-js';
import CryptoJSPackageJson from 'crypto-js/package.json';
import { ALLOWED_GLOBALS } from './allowed-globals';
import { isJSONPrimitive, JSONPrimitive } from './json';

export type LogMessage = string | Error;

export async function execute({
  environmentVariables,
  script,
}: {
  environmentVariables: Record<string, JSONPrimitive>;
  script: string;
}) {
  const inWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  // Confirm the build pipeline worked and this is running inside a worker and not the main thread
  if (!inWorker) {
    throw new Error(
      'Preflight script must always be run in web workers, this is a problem with laboratory not user input',
    );
  }

  // When running in worker `environmentVariables` will not be a reference to the main thread value
  // but sometimes this will be tested outside the worker, so we don't want to mutate the input in that case
  const workingEnvironmentVariables = { ...environmentVariables };

  // List all variables that we want to allow users to use inside their scripts
  const allowedGlobals = new Set([
    ...ALLOWED_GLOBALS,
    // We aren't allowing access to window.console, but we need to "allow" it
    // here so a second argument isn't added for it below.
    'console',
  ]);

  // generate list of all in scope variables, we do getOwnPropertyNames and `for in` because each contain slightly different sets of keys
  const allGlobalKeys = Object.getOwnPropertyNames(globalThis);
  for (const key in globalThis) {
    allGlobalKeys.push(key);
  }

  // filter out allowed global variables and keys that will cause problems
  const blockedGlobals = allGlobalKeys.filter(
    key =>
      // When testing in the main thread this exists on window and is not a valid argument name.
      // because global is blocked, even if this was in the worker it's still wouldn't be available because it's not a valid variable name
      !key.includes('-') &&
      !allowedGlobals.has(key) &&
      // window has references as indexes on the globalThis such as `globalThis[0]`, numbers are not valid arguments, so we need to filter these out
      Number.isNaN(Number(key)) &&
      // @ is not a valid argument name beginning character, so we don't need to block it and including it will cause a syntax error
      // only example currently is @wry/context which is a dep of @apollo/client and adds @wry/context:Slot
      key.charAt(0) !== '@',
  );
  // restrict window variable
  blockedGlobals.push('window');

  const messages: LogMessage[] = [];

  const log =
    (level: 'log' | 'warn' | 'error' | 'info') =>
    (...args: unknown[]) => {
      console[level](...args);
      messages.push(
        `${level.charAt(0).toUpperCase()}${level.slice(1)}: ${args.map(String).join(' ')}`,
      );
    };

  function getValidEnvVariable(value: unknown) {
    if (isJSONPrimitive(value)) {
      return value;
    }
    consoleApi.warn(
      'You tried to set a non primitive type in env variables, only string, boolean, number and null are allowed in env variables. The value has been filtered out.',
    );
  }

  const consoleApi = Object.freeze({
    log: log('log'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  });

  let hasLoggedCryptoJSVersion = false;

  const labApi = Object.freeze({
    get CryptoJS() {
      if (!hasLoggedCryptoJSVersion) {
        hasLoggedCryptoJSVersion = true;
        consoleApi.info(`Using crypto-js version: ${CryptoJSPackageJson.version}`);
      }
      return CryptoJS;
    },
    environment: {
      get(key: string) {
        return Object.freeze(workingEnvironmentVariables[key]);
      },
      set(key: string, value: unknown) {
        const validValue = getValidEnvVariable(value);
        if (validValue === undefined) {
          delete workingEnvironmentVariables[key];
        } else {
          workingEnvironmentVariables[key] = validValue;
        }
      },
    },
  });

  try {
    await Function(
      'lab',
      'console',
      // spreading all the variables we want to block creates an argument that shadows their names, any attempt to access them will result in `undefined`
      ...blockedGlobals,
      // Wrap the users script in an async IIFE to allow the use of top level await
      `return(async()=>{'use strict';${script}})()`,
      // Bind the function to a null constructor object to prevent `this` leaking scope in
    ).bind(
      // When `this` is `undefined` or `null`, we get [object DedicatedWorkerGlobalScope] in console output
      // instead we set as string `'undefined'` so in console, we'll see undefined as well
      'undefined',
    )(labApi, consoleApi);
  } catch (error) {
    if (error instanceof Error) {
      messages.push(error);
    } else {
      throw error;
    }
  }

  return {
    environmentVariables: workingEnvironmentVariables,
    logs: messages,
  };
}
