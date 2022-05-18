// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
import { createServicesFetcher, createSchemaFetcher } from '../src/gateways';

afterEach(() => {
  nock.cleanAll();
});

test('createServicesFetcher', async () => {
  const schema = {
    sdl: 'type Query { noop: String }',
    url: 'service-url',
    name: 'service-name',
  };
  const key = 'secret-key';
  nock('http://localhost')
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(() => [200, [schema]]);

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
});

test('createSchemaFetcher', async () => {
  const schema = {
    sdl: 'type Query { noop: String }',
    url: 'service-url',
    name: 'service-name',
  };
  const key = 'secret-key';
  nock('http://localhost')
    .get('/schema')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('accept', 'application/json')
    .reply(() => [200, schema]);

  const fetcher = createSchemaFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result.id).toBeDefined();
  expect(result.name).toEqual(schema.name);
  expect(result.sdl).toEqual(schema.sdl);
  expect(result.url).toEqual(schema.url);
});
