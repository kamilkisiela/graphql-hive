// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
import { createServicesFetcher, createSchemaFetcher } from '../src/gateways';

afterEach(() => {
  nock.cleanAll();
});

test('createServicesFetcher without ETag', async () => {
  const schema = {
    sdl: 'type Query { noop: String }',
    url: 'service-url',
    name: 'service-name',
  };
  const newSchema = {
    sdl: 'type NewQuery { noop: String }',
    url: 'new-service-url',
    name: 'new-service-name',
  };
  const key = 'secret-key';
  nock('http://localhost')
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(() => [200, [schema]])
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(() => [200, [newSchema]]);

  const fetcher = createServicesFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result).toHaveLength(1);
  expect(result[0].id).toBeDefined();
  expect(result[0].name).toEqual(schema.name);
  expect(result[0].sdl).toEqual(schema.sdl);
  expect(result[0].url).toEqual(schema.url);

  const secondResult = await fetcher();

  expect(secondResult).toHaveLength(1);
  expect(secondResult[0].id).toBeDefined();
  expect(secondResult[0].name).toEqual(newSchema.name);
  expect(secondResult[0].sdl).toEqual(newSchema.sdl);
  expect(secondResult[0].url).toEqual(newSchema.url);
});

test('createServicesFetcher with ETag', async () => {
  const schema = {
    sdl: 'type Query { noop: String }',
    url: 'service-url',
    name: 'service-name',
  };
  const newSchema = {
    sdl: 'type NewQuery { noop: String }',
    url: 'new-service-url',
    name: 'new-service-name',
  };
  const key = 'secret-key';
  nock('http://localhost')
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(200, [schema], {
      ETag: 'first',
    })
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .matchHeader('If-None-Match', 'first')
    .reply(304)
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .matchHeader('If-None-Match', 'first')
    .reply(200, [newSchema], {
      ETag: 'changed',
    });

  const fetcher = createServicesFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const firstResult = await fetcher();

  expect(firstResult).toHaveLength(1);
  expect(firstResult[0].id).toBeDefined();
  expect(firstResult[0].name).toEqual(schema.name);
  expect(firstResult[0].sdl).toEqual(schema.sdl);
  expect(firstResult[0].url).toEqual(schema.url);

  const secondResult = await fetcher();

  expect(secondResult).toHaveLength(1);
  expect(secondResult[0].id).toBeDefined();
  expect(secondResult[0].name).toEqual(schema.name);
  expect(secondResult[0].sdl).toEqual(schema.sdl);
  expect(secondResult[0].url).toEqual(schema.url);

  const staleResult = await fetcher();

  expect(staleResult).toHaveLength(1);
  expect(staleResult[0].id).toBeDefined();
  expect(staleResult[0].name).toEqual(newSchema.name);
  expect(staleResult[0].sdl).toEqual(newSchema.sdl);
  expect(staleResult[0].url).toEqual(newSchema.url);
});

test('createSchemaFetcher without ETag (older versions)', async () => {
  const schema = {
    sdl: 'type Query { noop: String }',
    url: 'service-url',
    name: 'service-name',
  };
  const newSchema = {
    sdl: 'type NewQuery { noop: String }',
    url: 'new-service-url',
    name: 'new-service-name',
  };
  const key = 'secret-key';
  nock('http://localhost')
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(() => [200, schema])
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(() => [200, newSchema]);

  const fetcher = createSchemaFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result.id).toBeDefined();
  expect(result.name).toEqual(schema.name);
  expect(result.sdl).toEqual(schema.sdl);
  expect(result.url).toEqual(schema.url);

  const newResult = await fetcher();

  expect(newResult.id).toBeDefined();
  expect(newResult.name).toEqual(newSchema.name);
  expect(newResult.sdl).toEqual(newSchema.sdl);
  expect(newResult.url).toEqual(newSchema.url);
});

test('createSchemaFetcher with ETag', async () => {
  const schema = {
    sdl: 'type Query { noop: String }',
    url: 'service-url',
    name: 'service-name',
  };
  const newSchema = {
    sdl: 'type NewQuery { noop: String }',
    url: 'new-service-url',
    name: 'new-service-name',
  };
  const key = 'secret-key';
  nock('http://localhost')
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(200, schema, {
      ETag: 'first',
    })
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .matchHeader('If-None-Match', 'first')
    .reply(304)
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .matchHeader('If-None-Match', 'first')
    .reply(200, newSchema, {
      ETag: 'changed',
    });

  const fetcher = createSchemaFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const firstResult = await fetcher();

  expect(firstResult.id).toBeDefined();
  expect(firstResult.name).toEqual(schema.name);
  expect(firstResult.sdl).toEqual(schema.sdl);
  expect(firstResult.url).toEqual(schema.url);

  const secondResult = await fetcher();

  expect(secondResult.id).toBeDefined();
  expect(secondResult.name).toEqual(schema.name);
  expect(secondResult.sdl).toEqual(schema.sdl);
  expect(secondResult.url).toEqual(schema.url);

  const staleResult = await fetcher();

  expect(staleResult.id).toBeDefined();
  expect(staleResult.name).toEqual(newSchema.name);
  expect(staleResult.sdl).toEqual(newSchema.sdl);
  expect(staleResult.url).toEqual(newSchema.url);
});
