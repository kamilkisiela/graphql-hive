// eslint-disable-next-line import/no-extraneous-dependencies
import nock from 'nock';
import { createSupergraphSDLFetcher } from '../src/apollo';

test('createSupergraphSDLFetcher', async () => {
  const supergraphSdl = 'type SuperQuery { sdl: String }';
  const key = 'secret-key';
  nock('http://localhost')
    .get('/supergraph')
    .once()
    .matchHeader('X-Hive-CDN-Key', key)
    .reply(() => [200, supergraphSdl]);

  const fetcher = createSupergraphSDLFetcher({
    endpoint: 'http://localhost',
    key,
  });

  const result = await fetcher();

  expect(result.id).toBeDefined();
  expect(result.supergraphSdl).toEqual(supergraphSdl);
});
