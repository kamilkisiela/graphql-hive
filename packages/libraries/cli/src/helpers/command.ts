import colors from 'colors';
import { ClientError, GraphQLClient } from 'graphql-request';
import symbols from 'log-symbols';
import { Argv } from 'yargs';
import { version } from '../version';
import { Config, GetConfigurationValueType, ValidConfigurationKeys } from './config';
import { importRequiredModules, processCwd, processEnv, processExit } from './process';

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

function graphql(registry: string, token: string) {
  const client = new GraphQLClient(registry, {
    headers: {
      Accept: 'application/json',
      'User-Agent': `hive-cli/${version}`,
      Authorization: `Bearer ${token}`,
      'graphql-client-name': 'Hive CLI',
      'graphql-client-version': version,
    },
  });

  return client;
}

const logger = {
  log(...args: any[]) {
    console.log(...args);
  },
  success(...args: any[]) {
    console.log(colors.green(symbols.success), ...args);
  },
  fail(...args: any[]) {
    console.log(colors.red(symbols.error), ...args);
  },
  info(...args: any[]) {
    console.log(colors.yellow(symbols.info), ...args);
  },
  infoWarning(...args: any[]) {
    console.log(colors.yellow(symbols.warning), ...args);
  },
};

function bolderize(msg: string) {
  const findSingleQuotes = /'([^']+)'/gim;
  const findDoubleQuotes = /"([^"]+)"/gim;

  return msg
    .replace(findSingleQuotes, (_: string, value: string) => colors.bold(value))
    .replace(findDoubleQuotes, (_: string, value: string) => colors.bold(value));
}

function maybe<TArgs extends Record<string, any>, TKey extends keyof TArgs>({
  key,
  env,
  args,
}: {
  key: TKey;
  env: string;
  args: TArgs;
}) {
  if (args[key] != null) {
    return args[key];
  }

  if (env && processEnv[env]) {
    return processEnv[env];
  }

  return undefined;
}

function cleanRequestId(requestId?: string | null) {
  return requestId ? requestId.split(',')[0].trim() : undefined;
}

export function buildContext() {
  const userConfig = new Config({
    // eslint-disable-next-line no-process-env
    filepath: processEnv['HIVE_CONFIG'],
    rootDir: processCwd,
  });

  function exit(
    type: 'success' | 'failure',
    options?: {
      message?: string;
      stack?: string;
      ref?: string;
      suggestion?: string;
    },
  ): never {
    if (options?.message) {
      logger.fail(options?.message);
    }

    if (options?.stack) {
      logger.log(colors.dim(options.stack));
    }

    if (options?.ref) {
      logger.info(colors.dim(`reference: ${options.ref}`));
    }

    if (options?.suggestion) {
      logger.info(colors.dim(`Suggestion: ${options.suggestion}`));
    }
    // just to make sure we exit, like really really exit
    const exitCode = type === 'failure' ? 1 : 0;
    return processExit(exitCode);
  }

  return {
    userConfig,
    logger,
    graphql,
    bolderize,
    maybe,
    exit,
    /**
     * Get a value from arguments or flags first, then from env variables,
     * then fallback to config.
     * Throw when there's no value.
     *
     * @param key
     * @param args all arguments or flags
     * @param defaultValue default value
     * @param message custom error message in case of no value
     * @param env an env var name
     */
    ensure<
      TKey extends ValidConfigurationKeys,
      TArgs extends {
        [key in TKey]: GetConfigurationValueType<TKey>;
      },
    >({
      key,
      args,
      legacyFlagName,
      defaultValue,
      message,
      env,
    }: {
      args: TArgs;
      key: TKey;
      /** By default we try to match config names with flag names, but for legacy compatibility we need to provide the old flag name. */
      legacyFlagName?: keyof OmitNever<{
        // Symbol.asyncIterator to discriminate against any lol
        [TArgKey in keyof TArgs]: typeof Symbol.asyncIterator extends TArgs[TArgKey]
          ? never
          : string extends TArgs[TArgKey]
          ? TArgKey
          : never;
      }>;

      defaultValue?: TArgs[keyof TArgs] | null;
      message?: string;
      env?: string;
    }): NonNullable<GetConfigurationValueType<TKey>> | never {
      if (args[key] != null) {
        return args[key] as NonNullable<GetConfigurationValueType<TKey>>;
      }

      if (legacyFlagName && (args as any)[legacyFlagName] != null) {
        return args[legacyFlagName] as any as NonNullable<GetConfigurationValueType<TKey>>;
      }

      // eslint-disable-next-line no-process-env
      if (env && processEnv[env]) {
        // eslint-disable-next-line no-process-env
        return processEnv[env] as TArgs[keyof TArgs] as NonNullable<
          GetConfigurationValueType<TKey>
        >;
      }

      const userConfigValue = userConfig.get(key);

      if (userConfigValue != null) {
        return userConfigValue;
      }

      if (defaultValue) {
        return defaultValue;
      }

      if (message) {
        return exit('failure', { message });
      }

      return exit('failure', {
        message: `Missing "${String(key)}"`,
      });
    },
    async require(requiredModules: string[]) {
      if (requiredModules && requiredModules.length > 0) {
        await importRequiredModules(requiredModules);
      }
    },
    handleFetchError(error: unknown): never {
      if (typeof error === 'string') {
        return exit('failure', { message: error });
      }

      if (error instanceof Error) {
        if (isClientError(error)) {
          const errors = error.response?.errors;

          if (Array.isArray(errors) && errors.length > 0) {
            return exit('failure', {
              message: errors[0].message,
              ref: cleanRequestId(error.response?.headers?.get('x-request-id')),
            });
          }

          return exit('failure', {
            message: error.message,
            ref: cleanRequestId(error.response?.headers?.get('x-request-id')),
          });
        }
        return exit('failure', {
          message: error.message,
        });
      }

      return exit('failure', {
        message: JSON.stringify(error),
      });
    },
  };
}

export type Context = ReturnType<typeof buildContext>;

export function createCommand(
  builder: (yargs: Argv, context: Context) => Argv,
): (yargs: Argv, context: Context) => Argv {
  return (yargs, context) => {
    return builder(yargs, context);
  };
}

function isClientError(error: Error): error is ClientError {
  return 'response' in error;
}
