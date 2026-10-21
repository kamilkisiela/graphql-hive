import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { SchemaHelper } from './schema-helper';

describe('SchemaHelper.createChecksum', () => {
  const schema = {
    id: 'schema-id',
    sdl: /* GraphQL */ `
      type Query {
        ping: String
      }
    `,
    serviceName: null,
    serviceUrl: null,
  } as const;

  test('treats formatting-equivalent metadata as the same schema', () => {
    const helper = new SchemaHelper();

    expect(helper.createChecksum({ ...schema, metadata: '{"a":1,"b":2}' })).toBe(
      helper.createChecksum({ ...schema, metadata: '{ "b": 2, "a": 1 }' }),
    );
  });

  test('returns a checksum for metadata that is not valid JSON', () => {
    const helper = new SchemaHelper();
    const invalidMetadata = { ...schema, metadata: '{ not json' };

    expect(helper.createChecksum(invalidMetadata)).toEqual(expect.any(String));
    expect(helper.createChecksum(invalidMetadata)).not.toBe(
      helper.createChecksum({ ...schema, metadata: '{"a":1}' }),
    );
  });
});
