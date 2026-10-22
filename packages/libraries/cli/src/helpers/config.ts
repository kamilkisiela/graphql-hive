import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { InvalidConfigError } from './errors';

const LegacyConfigModel = z.object({
  registry: z.string().optional(),
  token: z.string().optional(),
});

/** Keep `hive.schema.json` in step with this; `tests/config.spec.ts` checks that they agree. */
export const ConfigModel = z.object({
  registry: z
    .object({
      endpoint: z.string().url().optional(),
      accessToken: z.string().optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
  cdn: z
    .object({
      endpoint: z.string().url().optional(),
      accessToken: z.string().optional(),
    })
    .optional(),
});

export type ConfigModelType = z.TypeOf<typeof ConfigModel>;

type BuildPropertyPath<TObject extends z.ZodObject<any>> = `.${GetConfigurationKeys<TObject>}`;

type GetConfigurationKeys<
  T extends z.ZodObject<{
    [key: string]: z.ZodType<any, any>;
  }>,
> =
  T extends z.ZodObject<infer TObjectShape>
    ? TObjectShape extends Record<infer TKey, infer TObjectPropertyType>
      ? TKey extends string
        ? `${TKey}${TObjectPropertyType extends z.ZodObject<any>
            ? BuildPropertyPath<TObjectPropertyType>
            : TObjectPropertyType extends z.ZodOptional<infer TOptionalInnerObjectPropertyType>
              ? TOptionalInnerObjectPropertyType extends z.ZodObject<any>
                ? BuildPropertyPath<TOptionalInnerObjectPropertyType>
                : ''
              : ''}`
        : never
      : never
    : never;

type GetZodValueType<
  TString extends string,
  ConfigurationModelType extends z.ZodObject<any>,
> = TString extends `${infer TKey}.${infer TNextKey}`
  ? ConfigurationModelType extends z.ZodObject<infer InnerType>
    ? InnerType[TKey] extends z.ZodObject<any>
      ? GetZodValueType<TNextKey, InnerType[TKey]>
      : InnerType[TKey] extends z.ZodOptional<infer OptionalInner>
        ? OptionalInner extends z.ZodObject<any>
          ? GetZodValueType<TNextKey, OptionalInner>
          : never
        : never
    : never
  : ConfigurationModelType extends z.ZodObject<infer InnerType>
    ? z.TypeOf<InnerType[TString]>
    : never;

export type GetConfigurationValueType<TString extends string> = GetZodValueType<
  TString,
  typeof ConfigModel
>;

export type ValidConfigurationKeys = GetConfigurationKeys<typeof ConfigModel>;

export const graphqlEndpoint = 'https://app.graphql-hive.com/graphql';

export class Config {
  private cache?: ConfigModelType;
  private filepath: string;
  private isExplicitFilepath: boolean;

  constructor({ filepath, rootDir }: { filepath?: string; rootDir: string }) {
    this.isExplicitFilepath = !!filepath;
    if (filepath) {
      this.filepath = filepath;
    } else {
      this.filepath = path.join(rootDir, 'hive.json');
    }
  }

  get<TKey extends ValidConfigurationKeys>(
    key: TKey,
  ): GetZodValueType<TKey, typeof ConfigModel> | null {
    const map = this.read();

    const parts = key.split('.');
    let current: any = map;
    for (const part of parts) {
      if (current == null) {
        return null;
      }

      current = current[part];
    }

    return current as GetZodValueType<TKey, typeof ConfigModel>;
  }

  private readSpace(content: unknown): unknown {
    // eslint-disable-next-line no-process-env
    const space = process.env.HIVE_SPACE;

    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new InvalidConfigError(this.filepath, 'Expected a JSON object.');
    }

    if (space) {
      if (!(space in content)) {
        throw new InvalidConfigError(
          this.filepath,
          `The space "${space}" set with HIVE_SPACE does not exist.`,
        );
      }
      return (content as Record<string, unknown>)[space];
    }

    if ('default' in content) {
      return (content as Record<string, unknown>)['default'];
    }

    return content;
  }

  private read(): ConfigModelType {
    if (this.cache) {
      return this.cache;
    }

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(this.filepath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT' && !this.isExplicitFilepath) {
        this.cache = emptyConfig();
        return this.cache;
      }
      throw new InvalidConfigError(
        this.filepath,
        error instanceof Error ? error.message : String(error),
      );
    }

    let content: unknown;
    try {
      content = JSON.parse(rawContent);
    } catch (error) {
      throw new InvalidConfigError(
        this.filepath,
        `Invalid JSON. ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const space = this.readSpace(content);

    if (isLegacyConfig(space)) {
      const legacyConfig = LegacyConfigModel.safeParse(space);
      if (!legacyConfig.success) {
        throw new InvalidConfigError(this.filepath, formatConfigIssues(legacyConfig.error));
      }
      this.cache = {
        ...emptyConfig(),
        registry: {
          endpoint: legacyConfig.data.registry,
          accessToken: legacyConfig.data.token,
          headers: undefined,
        },
      };
      return this.cache;
    }

    const config = ConfigModel.safeParse(space);
    if (!config.success) {
      throw new InvalidConfigError(this.filepath, formatConfigIssues(config.error));
    }

    this.cache = config.data;
    return this.cache;
  }
}

function emptyConfig(): ConfigModelType {
  return {
    registry: {
      endpoint: undefined,
      accessToken: undefined,
      headers: undefined,
    },
    cdn: {
      endpoint: undefined,
      accessToken: undefined,
    },
  };
}

/** The legacy format uses top-level "registry" (string) and "token" keys. */
function isLegacyConfig(content: unknown): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }
  const { registry } = content as Record<string, unknown>;
  return (
    typeof registry === 'string' ||
    ('token' in content && (registry === undefined || registry === null))
  );
}

function formatConfigIssues(error: z.ZodError): string {
  return error.issues
    .map(issue => `${issue.path.length ? `"${issue.path.join('.')}": ` : ''}${issue.message}`)
    .join('; ');
}
