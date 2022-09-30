import { Command, Config as OclifConfig, Errors } from '@oclif/core';
import colors from 'colors';
import symbols from 'log-symbols';
import { GraphQLClient, ClientError } from 'graphql-request';
import { Config } from './helpers/config';
import { getSdk } from './sdk';

export default abstract class extends Command {
  protected _userConfig: Config;

  protected constructor(argv: string[], config: OclifConfig) {
    super(argv, config);

    this._userConfig = new Config({
      filepath: process.env.HIVE_CONFIG,
      rootDir: process.cwd(),
    });
  }

  success(...args: any[]) {
    this.log(colors.green(symbols.success), ...args);
  }

  fail(...args: any[]) {
    this.log(colors.red(symbols.error), ...args);
  }

  info(...args: any[]) {
    this.log(colors.yellow(symbols.info), ...args);
  }

  bolderize(msg: string) {
    const findSingleQuotes = /'([^']+)'/gim;
    const findDoubleQuotes = /"([^"]+)"/gim;

    return msg
      .replace(findSingleQuotes, (_: string, value: string) => colors.bold(value))
      .replace(findDoubleQuotes, (_: string, value: string) => colors.bold(value));
  }

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
    TArgs extends {
      [key: string]: any;
    },
    TKey extends keyof TArgs
  >({
    key,
    args,
    defaultValue,
    message,
    env,
  }: {
    key: TKey;
    args: TArgs;
    defaultValue?: TArgs[TKey] | null;
    message?: string;
    env?: string;
  }): NonNullable<TArgs[TKey]> | never {
    if (args[key]) {
      return args[key];
    }

    if (env && process.env[env]) {
      return process.env[env] as TArgs[TKey];
    }

    if (this._userConfig.has(key as string)) {
      return this._userConfig.get(key as string);
    }

    if (defaultValue) {
      return defaultValue;
    }

    if (message) {
      throw new Errors.CLIError(message);
    }

    throw new Errors.CLIError(`Missing "${String(key)}"`);
  }

  /**
   * Get a value from arguments or flags first, then fallback to config.
   * Do NOT throw when there's no value.
   *
   * @param key
   * @param args all arguments or flags
   */
  maybe<
    TArgs extends {
      [key: string]: any;
    },
    TKey extends keyof TArgs
  >(key: TKey, args: TArgs): TArgs[TKey] | undefined {
    if (args[key]) {
      return args[key];
    }

    if (this._userConfig.has(key as string)) {
      return this._userConfig.get(key as string);
    }
  }

  cleanRequestId(requestId?: string | null) {
    return requestId ? requestId.split(',')[0].trim() : undefined;
  }

  registryApi(registry: string, token: string) {
    return getSdk(
      new GraphQLClient(registry, {
        headers: {
          Accept: 'application/json',
          'User-Agent': `HiveCLI@${this.config.version}`,
          Authorization: `Bearer ${token}`,
          'graphql-client-name': 'Hive CLI',
          'graphql-client-version': this.config.version,
        },
      })
    );
  }

  handleFetchError(error: unknown): never {
    if (typeof error === 'string') {
      return this.error(error);
    }

    if (error instanceof Error) {
      if (isClientError(error)) {
        const errors = error.response?.errors;

        if (Array.isArray(errors) && errors.length > 0) {
          return this.error(errors[0].message, {
            ref: this.cleanRequestId(error.response?.headers?.get('x-request-id')),
          });
        }

        return this.error(error.message, {
          ref: this.cleanRequestId(error.response?.headers?.get('x-request-id')),
        });
      }

      return this.error(error);
    }

    return this.error(JSON.stringify(error));
  }

  async require<
    TFlags extends {
      require: string[];
      [key: string]: any;
    }
  >(flags: TFlags) {
    if (flags.require && flags.require.length > 0) {
      await Promise.all(flags.require.map(mod => import(require.resolve(mod, { paths: [process.cwd()] }))));
    }
  }
}

function isClientError(error: Error): error is ClientError {
  return 'response' in error;
}
