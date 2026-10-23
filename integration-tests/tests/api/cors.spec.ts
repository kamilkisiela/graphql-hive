import { ensureEnv } from '../../testkit/env';
import { getServiceHost } from '../../testkit/utils';

const registryAddress = await getServiceHost('server', 8082);

const endpoint = `http://${registryAddress}`;

test('no origin header -> no CORS checks', async () => {
  const request = await fetch(`${endpoint}/graphql`);
  expect(request.headers.get('access-control-allow-origin')).toEqual(null);
  expect(request.headers.get('access-control-allow-credentials')).toEqual(null);
  expect(request.status).toEqual(200);
  expect(await request.text()).toMatchInlineSnapshot(
    `{"errors":[{"message":"Must provide query string.","extensions":{"code":"BAD_REQUEST"}}]}`,
  );
});

test('unmatching origin -> send CORS error', async () => {
  const request = await fetch(`${endpoint}/graphql`, {
    headers: {
      origin: 'https://evil.com',
    },
  });
  expect(request.headers.get('access-control-allow-origin')).toEqual(null);
  expect(request.headers.get('access-control-allow-credentials')).toEqual(null);
  expect(request.status).toEqual(403);
  // The refusal goes through the shared error handler, so it has the shared JSON shape.
  expect(await request.json()).toMatchObject({ error: 403, message: 'CORS origin not allowed.' });
});

test('matching origin -> send correct CORS headers', async () => {
  const request = await fetch(`${endpoint}/graphql`, {
    headers: {
      origin: ensureEnv('HIVE_APP_BASE_URL'),
    },
  });
  expect(request.headers.get('access-control-allow-origin')).toEqual(
    ensureEnv('HIVE_APP_BASE_URL'),
  );
  expect(request.headers.get('access-control-allow-credentials')).toEqual('true');
  expect(request.status).toEqual(200);
  expect(await request.text()).toMatchInlineSnapshot(
    `{"errors":[{"message":"Must provide query string.","extensions":{"code":"BAD_REQUEST"}}]}`,
  );
});
