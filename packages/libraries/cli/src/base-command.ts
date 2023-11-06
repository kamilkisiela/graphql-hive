import colors from 'colors';
import { print, type GraphQLError } from 'graphql';
import type { ExecutionResult } from 'graphql';
import symbols from 'log-symbols';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Command, Errors, Config as OclifConfig } from '@oclif/core';
import { fetch } from '@whatwg-node/fetch';
import { Config, GetConfigurationValueType, ValidConfigurationKeys } from './helpers/config';

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

export default abstract class extends Command {
  protected _userConfig: Config;

  protected constructor(argv: string[], config: OclifConfig) {
    super(argv, config);

    this._userConfig = new Config({
      // eslint-disable-next-line no-process-env
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

  infoWarning(...args: any[]) {
    this.log(colors.yellow(symbols.warning), ...args);
  }

  bolderize(msg: string) {
    const findSingleQuotes = /'([^']+)'/gim;
    const findDoubleQuotes = /"([^"]+)"/gim;

    return msg
      .replace(findSingleQuotes, (_: string, value: string) => colors.bold(value))
      .replace(findDoubleQuotes, (_: string, value: string) => colors.bold(value));
  }

  maybe<TArgs extends Record<string, any>, TKey extends keyof TArgs>({
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

    // eslint-disable-next-line no-process-env
    if (env && process.env[env]) {
      // eslint-disable-next-line no-process-env
      return process.env[env];
    }

    return undefined;
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
    if (env && process.env[env]) {
      // eslint-disable-next-line no-process-env
      return process.env[env] as TArgs[keyof TArgs] as NonNullable<GetConfigurationValueType<TKey>>;
    }

    const userConfigValue = this._userConfig.get(key);

    if (userConfigValue != null) {
      return userConfigValue;
    }

    if (defaultValue) {
      return defaultValue;
    }

    if (message) {
      throw new Errors.CLIError(message);
    }

    throw new Errors.CLIError(`Missing "${String(key)}"`);
  }

  cleanRequestId(requestId?: string | null) {
    return requestId ? requestId.split(',')[0].trim() : undefined;
  }

  registryApi(registry: string, token: string) {
    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': `hive-cli/${this.config.version}`,
      Authorization: `Bearer ${token}`,
      'graphql-client-name': 'Hive CLI',
      'graphql-client-version': this.config.version,
    };

    return {
      async request<TResult, TVariables>(
        operation: TypedDocumentNode<TResult, TVariables>,
        ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
      ): Promise<TResult> {
        const response = await fetch(registry, {
          headers: requestHeaders,
          method: 'POST',
          body: JSON.stringify({
            query: typeof operation === 'string' ? operation : print(operation),
            variables,
          }),
        });

        if (!response.ok) {
          throw new Error(`Invalid status code for registry HTTP call: ${response.status}`);
        }

        const jsonData = (await response.json()) as ExecutionResult<TResult>;

        if (jsonData.errors && jsonData.errors.length > 0) {
          throw new ClientError(
            `Failed to execute GraphQL operation: ${jsonData.errors
              .map(e => e.message)
              .join('\n')}`,
            {
              errors: jsonData.errors,
              headers: response.headers,
            },
          );
        }

        return jsonData.data!;
      },
    };
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
    },
  >(flags: TFlags) {
    if (flags.require && flags.require.length > 0) {
      await Promise.all(
        flags.require.map(mod => import(require.resolve(mod, { paths: [process.cwd()] }))),
      );
    }
  }
}

class ClientError extends Error {
  constructor(
    message: string,
    public response: {
      errors?: readonly GraphQLError[];
      headers: Headers;
    },
  ) {
    super(message);
  }
}

function isClientError(error: Error): error is ClientError {
  return error instanceof ClientError;
}
