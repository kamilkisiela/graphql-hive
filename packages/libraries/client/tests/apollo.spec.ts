// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
import { createSupergraphSDLFetcher } from '../src/apollo';
import { version } from '../src/version';

test('createSupergraphSDLFetcher without ETag', async () => {
  const supergraphSdl = 'type SuperQuery { sdl: String }';
  const newSupergraphSdl = 'type NewSuperQuery { sdl: String }';
  const key = 'secret-key';
  nock('http://localhost')
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .reply(200, supergraphSdl, {
      ETag: 'first',
    })
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('User-Agent', `hive-client/${version}`)
    .reply(200, newSupergraphSdl, {
      ETag: 'second',
    });

  const fetcher = createSupergraphSDLFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result.id).toBeDefined();
  expect(result.supergraphSdl).toEqual(supergraphSdl);

  const secondResult = await fetcher();

  expect(secondResult.id).toBeDefined();
  expect(secondResult.supergraphSdl).toEqual(newSupergraphSdl);
});

test('createSupergraphSDLFetcher', async () => {
  const supergraphSdl = 'type SuperQuery { sdl: String }';
  const newSupergraphSdl = 'type Query { sdl: String }';
  const key = 'secret-key';
  nock('http://localhost')
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .reply(200, supergraphSdl, {
      ETag: 'first',
    })
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('If-None-Match', 'first')
    .reply(304)
    .get('/supergraph')
    .matchHeader('X-Hive-CDN-Key', key)
    .matchHeader('User-Agent', `hive-client/${version}`)
    .matchHeader('If-None-Match', 'first')
    .reply(200, newSupergraphSdl, {
      ETag: 'changed',
    });

  const fetcher = createSupergraphSDLFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result.id).toBeDefined();
  expect(result.supergraphSdl).toEqual(supergraphSdl);

  const cachedResult = await fetcher();

  expect(cachedResult.id).toBeDefined();
  expect(cachedResult.supergraphSdl).toEqual(supergraphSdl);

  const staleResult = await fetcher();

  expect(staleResult.id).toBeDefined();
  expect(staleResult.supergraphSdl).toEqual(newSupergraphSdl);
});

test('createSupergraphSDLFetcher retry with unexpected status code (nRetryCount=10)', async () => {
  const supergraphSdl = 'type SuperQuery { sdl: String }';
  const key = 'secret-key';
  nock('http://localhost')
    .get('/supergraph')
    .times(10)
    .reply(500)
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .reply(200, supergraphSdl, {
      ETag: 'first',
    });

  const fetcher = createSupergraphSDLFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result.id).toBeDefined();
  expect(result.supergraphSdl).toEqual(supergraphSdl);
});

test('createSupergraphSDLFetcher retry with unexpected status code (nRetryCount=11)', async () => {
  expect.assertions(1);
  const supergraphSdl = 'type SuperQuery { sdl: String }';
  const key = 'secret-key';
  nock('http://localhost')
    .get('/supergraph')
    .times(11)
    .reply(500)
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .reply(200, supergraphSdl, {
      ETag: 'first',
    });

  const fetcher = createSupergraphSDLFetcher({
    endpoint: 'http://localhost',
    key,
  });

  try {
    await fetcher();
  } catch (err) {
    expect(err).toMatchInlineSnapshot(`[Error: Failed to fetch [500]]`);
  }
});
