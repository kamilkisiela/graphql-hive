import { createCDNArtifactFetcher } from '../src';

test('can fetch artifact', async () => {
  const calls: Array<unknown> = [];
  const fetcher = createCDNArtifactFetcher({
    endpoint: 'https://cdn.localhost/artifacts/v1/target/sdl',
    accessKey: 'foobars',
    async fetch(input) {
      calls.push(input);
      return new Response('type Query { hello: String }', {
        headers: {
          'x-hive-schema-version-id': '69',
        },
      });
    },
  });

  const result = await fetcher.fetch();
  expect(result).toMatchInlineSnapshot(`
    {
      contents: type Query { hello: String },
      graphId: null,
      graphVersionId: 69,
      hash: lPMnu/9YxAJHyFqOBpHcrya5Bihef1wDGz7iKcif5nY=,
      lastModified: null,
      schemaVersionId: 69,
    }
  `);
  expect(calls).toMatchInlineSnapshot(`
    [
      https://cdn.localhost/artifacts/v1/target/sdl,
    ]
  `);
});

test('calls mirror if main source is not working', async () => {
  const calls: Array<unknown> = [];
  const fetcher = createCDNArtifactFetcher({
    endpoint: [
      'https://cdn.localhost/artifacts/v1/target/sdl',
      'https://cdn-mirror.localhost/artifacts/v1/target/sdl',
    ],
    accessKey: 'foobars',
    retry: false,
    circuitBreaker: {
      volumeThreshold: 1,
      errorThresholdPercentage: 1,
      resetTimeout: 30_000,
    },
    async fetch(input) {
      calls.push(input);

      if (calls.length === 1) {
        throw new Error('Network error or something.');
      }
      if (calls.length === 2) {
        return new Response('type Query { hello: String }', {
          headers: {
            'x-hive-schema-version-id': '69',
          },
        });
      }

      throw new Error('This should not happen');
    },
  });

  const result = await fetcher.fetch();
  expect(result).toMatchInlineSnapshot(`
    {
      contents: type Query { hello: String },
      graphId: null,
      graphVersionId: 69,
      hash: lPMnu/9YxAJHyFqOBpHcrya5Bihef1wDGz7iKcif5nY=,
      lastModified: null,
      schemaVersionId: 69,
    }
  `);
  expect(calls).toMatchInlineSnapshot(`
    [
      https://cdn.localhost/artifacts/v1/target/sdl,
      https://cdn-mirror.localhost/artifacts/v1/target/sdl,
    ]
  `);
});
