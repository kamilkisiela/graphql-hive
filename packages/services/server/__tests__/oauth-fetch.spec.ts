import { createBrokerFetch } from '../src/oauth-fetch';

test('sends OAuth requests through the request broker', async () => {
  const response = new Response('{"access_token":"token"}');
  const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(response);
  const brokerFetch = createBrokerFetch(fetchImplementation, {
    endpoint: 'https://broker.example.com',
    signature: 'secret',
  });

  await expect(
    brokerFetch('https://oauth.example.com/token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ code: 'code' }),
    }),
  ).resolves.toBe(response);

  expect(fetchImplementation).toHaveBeenCalledWith('https://broker.example.com', {
    method: 'POST',
    headers: {
      accept: 'text/plain',
      'content-type': 'application/json',
      'x-hive-signature': 'secret',
    },
    body: JSON.stringify({
      url: 'https://oauth.example.com/token',
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'code=code',
      resolveResponseBody: true,
    }),
  });
});

test('uses direct fetch when the request broker is disabled', async () => {
  const response = new Response('{}');
  const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(response);
  const brokerFetch = createBrokerFetch(fetchImplementation, null);
  const init = { method: 'GET' };

  await expect(brokerFetch('https://oauth.example.com/userinfo', init)).resolves.toBe(response);
  expect(fetchImplementation).toHaveBeenCalledWith('https://oauth.example.com/userinfo', init);
});
