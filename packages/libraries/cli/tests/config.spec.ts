import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { Config, ConfigModel } from '../src/helpers/config';
import { InvalidConfigError } from '../src/helpers/errors';

function writeConfig(content: string) {
  const dir = mkdtempSync(join(tmpdir(), 'hive-cli-config-'));
  const filepath = join(dir, 'hive.json');
  writeFileSync(filepath, content);
  return { dir, filepath };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Config', () => {
  test('a missing default hive.json is an empty configuration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-cli-config-'));
    expect(new Config({ rootDir: dir }).get('registry.endpoint')).toBe(undefined);
  });

  test('a missing file set with HIVE_CONFIG is an invalid configuration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-cli-config-'));
    const config = new Config({ filepath: join(dir, 'missing.json'), rootDir: dir });
    expect(() => config.get('registry.endpoint')).toThrow(InvalidConfigError);
  });

  test('invalid JSON is an invalid configuration', () => {
    const { dir, filepath } = writeConfig('{ "registry": ');
    const config = new Config({ filepath, rootDir: dir });
    expect(() => config.get('registry.endpoint')).toThrow(/Invalid JSON/);
  });

  test('an invalid value names the key', () => {
    const { dir, filepath } = writeConfig(JSON.stringify({ registry: { endpoint: 'not-a-url' } }));
    const config = new Config({ filepath, rootDir: dir });
    expect(() => config.get('registry.endpoint')).toThrow(/"registry\.endpoint"/);
  });

  test('reads the current format', () => {
    const { dir, filepath } = writeConfig(
      JSON.stringify({
        registry: {
          endpoint: 'https://registry.example.com/graphql',
          accessToken: 'token',
          headers: { 'x-header': 'value' },
        },
      }),
    );
    const config = new Config({ filepath, rootDir: dir });
    expect(config.get('registry.endpoint')).toBe('https://registry.example.com/graphql');
    expect(config.get('registry.accessToken')).toBe('token');
    expect(config.get('registry.headers')).toEqual({ 'x-header': 'value' });
  });

  test('reads the legacy format', () => {
    const { dir, filepath } = writeConfig(
      JSON.stringify({ registry: 'https://registry.example.com/graphql', token: 'token' }),
    );
    const config = new Config({ filepath, rootDir: dir });
    expect(config.get('registry.endpoint')).toBe('https://registry.example.com/graphql');
    expect(config.get('registry.accessToken')).toBe('token');
  });

  test('reads the space set with HIVE_SPACE', () => {
    const { dir, filepath } = writeConfig(
      JSON.stringify({
        default: { registry: { accessToken: 'default-token' } },
        staging: { registry: { accessToken: 'staging-token' } },
      }),
    );
    expect(new Config({ filepath, rootDir: dir }).get('registry.accessToken')).toBe(
      'default-token',
    );

    vi.stubEnv('HIVE_SPACE', 'staging');
    expect(new Config({ filepath, rootDir: dir }).get('registry.accessToken')).toBe(
      'staging-token',
    );
  });

  test('an unknown HIVE_SPACE is an invalid configuration', () => {
    const { dir, filepath } = writeConfig(JSON.stringify({ default: {} }));
    vi.stubEnv('HIVE_SPACE', 'production');
    const config = new Config({ filepath, rootDir: dir });
    expect(() => config.get('registry.endpoint')).toThrow(/"production"/);
  });

  test('a "$schema" key does not change what is read', () => {
    const $schema = './node_modules/@graphql-hive/cli/hive.schema.json';
    const plain = writeConfig(JSON.stringify({ $schema, registry: { accessToken: 'token' } }));
    expect(
      new Config({ filepath: plain.filepath, rootDir: plain.dir }).get('registry.accessToken'),
    ).toBe('token');

    const spaces = writeConfig(
      JSON.stringify({ $schema, default: { registry: { accessToken: 'default-token' } } }),
    );
    expect(
      new Config({ filepath: spaces.filepath, rootDir: spaces.dir }).get('registry.accessToken'),
    ).toBe('default-token');
  });
});

describe('hive.schema.json', () => {
  type JsonSchemaNode = { properties?: Record<string, JsonSchemaNode> };
  const schema = JSON.parse(readFileSync(join(__dirname, '../hive.schema.json'), 'utf-8'));

  /** Every key path in the model, the way `Config.get` addresses them (`registry.endpoint`). */
  function modelKeys(model: z.ZodTypeAny, prefix = ''): string[] {
    const inner = model instanceof z.ZodOptional ? model.unwrap() : model;
    if (!(inner instanceof z.ZodObject)) {
      return [];
    }
    return Object.entries(inner.shape as Record<string, z.ZodTypeAny>).flatMap(([key, value]) => [
      prefix + key,
      ...modelKeys(value, `${prefix}${key}.`),
    ]);
  }

  function schemaKeys(node: JsonSchemaNode, prefix = ''): string[] {
    return Object.entries(node.properties ?? {})
      .filter(([key]) => key !== '$schema')
      .flatMap(([key, value]) => [prefix + key, ...schemaKeys(value, `${prefix}${key}.`)]);
  }

  test('describes the same keys as the config model', () => {
    expect(schemaKeys(schema.definitions.config).sort()).toEqual(modelKeys(ConfigModel).sort());
  });
});
