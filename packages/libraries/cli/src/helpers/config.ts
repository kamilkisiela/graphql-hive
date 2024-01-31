import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import * as zod from 'zod';

const LegacyConfigModel = zod.object({
  registry: zod.string().optional(),
  token: zod.string().optional(),
});

const ConfigModel = zod.object({
  registry: zod
    .object({
      endpoint: zod.string().url().optional(),
      accessToken: zod.string().optional(),
    })
    .optional(),
  cdn: zod
    .object({
      endpoint: zod.string().url().optional(),
      accessToken: zod.string().optional(),
    })
    .optional(),
});

const getAllowedConfigKeys = <TConfig extends zod.ZodObject<any>>(
  config: TConfig,
): Set<GetConfigurationKeys<TConfig>> => {
  const keys = new Set<GetConfigurationKeys<TConfig>>();

  const traverse = (obj: zod.ZodObject<Record<string, any>>, path: Array<string> = []): string => {
    if (obj instanceof zod.ZodObject) {
      const shape = obj.shape;
      for (const [key, value] of Object.entries(shape)) {
        traverse(value, [...path, key]);
      }
    } else {
      keys.add(path.join('.') as GetConfigurationKeys<TConfig>);
    }

    return path.join('.');
  };

  traverse(config);

  return keys;
};

export type ConfigModelType = zod.TypeOf<typeof ConfigModel>;

type BuildPropertyPath<TObject extends zod.ZodObject<any>> = `.${GetConfigurationKeys<TObject>}`;

type GetConfigurationKeys<
  T extends zod.ZodObject<{
    [key: string]: zod.ZodType<any, any>;
  }>,
> =
  T extends zod.ZodObject<infer TObjectShape>
    ? TObjectShape extends Record<infer TKey, infer TObjectPropertyType>
      ? TKey extends string
        ? `${TKey}${TObjectPropertyType extends zod.ZodObject<any>
            ? BuildPropertyPath<TObjectPropertyType>
            : TObjectPropertyType extends zod.ZodOptional<infer TOptionalInnerObjectPropertyType>
              ? TOptionalInnerObjectPropertyType extends zod.ZodObject<any>
                ? BuildPropertyPath<TOptionalInnerObjectPropertyType>
                : ''
              : ''}`
        : never
      : never
    : never;

type GetZodValueType<
  TString extends string,
  ConfigurationModelType extends zod.ZodObject<any>,
> = TString extends `${infer TKey}.${infer TNextKey}`
  ? ConfigurationModelType extends zod.ZodObject<infer InnerType>
    ? InnerType[TKey] extends zod.ZodObject<any>
      ? GetZodValueType<TNextKey, InnerType[TKey]>
      : InnerType[TKey] extends zod.ZodOptional<infer OptionalInner>
        ? OptionalInner extends zod.ZodObject<any>
          ? GetZodValueType<TNextKey, OptionalInner>
          : never
        : never
    : never
  : ConfigurationModelType extends zod.ZodObject<infer InnerType>
    ? zod.TypeOf<InnerType[TString]>
    : never;

export type GetConfigurationValueType<TString extends string> = GetZodValueType<
  TString,
  typeof ConfigModel
>;

export type ValidConfigurationKeys = GetConfigurationKeys<typeof ConfigModel>;

export const graphqlEndpoint = 'https://app.graphql-hive.com/graphql';

export const allowedKeys = Array.from(getAllowedConfigKeys(ConfigModel));

export class Config {
  private cache?: ConfigModelType;
  private filepath: string;

  constructor({ filepath, rootDir }: { filepath?: string; rootDir: string }) {
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

  set(key: ValidConfigurationKeys, value: string) {
    if (getAllowedConfigKeys(ConfigModel).has(key) === false) {
      throw new Error(`Invalid configuration key: ${key}`);
    }

    const map = this.read();
    const parts = key.split('.');

    let current: any = map;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (!current[part]) {
        current[part] = {};
      }
      if (i === parts.length - 1) {
        current[part] = value;
      }

      current = current[part];
    }

    this.write(map);
  }

  delete(key: string) {
    const map = this.read();
    const parts = key.split('.');

    let current: any = map;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (!current[part]) {
        current[part] = {};
      }
      if (i === parts.length - 1) {
        current[part] = undefined;
      }

      current = current[part];
    }

    this.write(map);
  }

  clear(): void {
    try {
      mkdirp.sync(path.dirname(this.filepath));
    } catch {}
    fs.writeFileSync(this.filepath, JSON.stringify({}), 'utf8');
  }

  private readSpace(content: Record<string, any>) {
    // eslint-disable-next-line no-process-env
    const space = process.env.HIVE_SPACE;

    if (space) {
      return content[space];
    }

    if ('default' in content) {
      return content['default'];
    }

    return content;
  }

  private read() {
    try {
      if (!this.cache) {
        const space: unknown = this.readSpace(JSON.parse(fs.readFileSync(this.filepath, 'utf-8')));

        const legacyConfig = LegacyConfigModel.safeParse(space);
        if (legacyConfig.success) {
          this.cache = {
            registry: {
              endpoint: legacyConfig.data.registry,
              accessToken: legacyConfig.data.token,
            },
            cdn: {
              endpoint: undefined,
              accessToken: undefined,
            },
          };
        }
        const config = ConfigModel.safeParse(space);
        // TODO: we should probably print a warning/error in case of an invalid config.
        if (config.success) {
          this.cache = config.data;
        } else {
          throw new Error('Invalid config.');
        }
      }
    } catch (error) {
      this.cache = {
        registry: {
          endpoint: undefined,
          accessToken: undefined,
        },
        cdn: {
          endpoint: undefined,
          accessToken: undefined,
        },
      };
    }

    return this.cache;
  }

  private write(map: ConfigModelType) {
    this.cache = map;
    try {
      mkdirp.sync(path.dirname(this.filepath));
    } catch (e) {}
    fs.writeFileSync(this.filepath, JSON.stringify(this.cache));
  }
}
