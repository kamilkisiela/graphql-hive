import colors from 'colors';
import { print, type GraphQLError } from 'graphql';
import type { ExecutionResult } from 'graphql';
import { http } from '@graphql-hive/core';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { Command, Errors, Flags, Interfaces } from '@oclif/core';
import { Config, GetConfigurationValueType, ValidConfigurationKeys } from './helpers/config';

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)['baseFlags'] & T['flags']
>;
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

export default abstract class BaseCommand<T extends typeof Command> extends Command {
  protected _userConfig: Config | undefined;

  static baseFlags = {
    debug: Flags.boolean({
      default: false,
      summary: 'Whether debug output for HTTP calls and similar should be enabled.',
    }),
  };

  protected flags!: Flags<T>;
  protected args!: Args<T>;

  protected get userConfig(): Config {
    if (!this._userConfig) {
      throw new Error('User config is not initialized');
    }
    return this._userConfig!;
  }

  public async init(): Promise<void> {
    await super.init();

    this._userConfig = new Config({
      // eslint-disable-next-line no-process-env
      filepath: process.env.HIVE_CONFIG,
      rootDir: process.cwd(),
    });

    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
  }

  success(...args: any[]) {
    this.log(colors.green('✔'), ...args);
  }

  fail(...args: any[]) {
    this.log(colors.red('✖'), ...args);
  }

  info(...args: any[]) {
    this.log(colors.yellow('ℹ'), ...args);
  }

  infoWarning(...args: any[]) {
    this.log(colors.yellow('⚠'), ...args);
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

    const userConfigValue = this._userConfig!.get(key);

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
      Authorization: `Bearer ${token}`,
      'graphql-client-name': 'Hive CLI',
      'graphql-client-version': this.config.version,
    };

    return this.graphql(registry, requestHeaders);
  }

  graphql(endpoint: string, additionalHeaders: Record<string, string> = {}) {
    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': `hive-cli/${this.config.version}`,
      ...additionalHeaders,
    };

    const isDebug = this.flags.debug;

    return {
      async request<TResult, TVariables>(
        args: {
          operation: TypedDocumentNode<TResult, TVariables>;
          /** timeout in milliseconds */
          timeout?: number;
        } & (TVariables extends Record<string, never>
          ? {
              variables?: never;
            }
          : {
              variables: TVariables;
            }),
      ): Promise<TResult> {
        const response = await http.post(
          endpoint,
          JSON.stringify({
            query: typeof args.operation === 'string' ? args.operation : print(args.operation),
            variables: args.variables,
          }),
          {
            logger: {
              info: (...args) => {
                if (isDebug) {
                  console.info(...args);
                }
              },
              error: (...args) => {
                console.error(...args);
              },
            },
            headers: requestHeaders,
            timeout: args.timeout,
          },
        );

        if (!response.ok) {
          throw new Error(`Invalid status code for HTTP call: ${response.status}`);
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
