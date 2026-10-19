import { getServiceHost } from 'testkit/utils';

async function graphqlEndpoint() {
  const address = await getServiceHost('server', 8082);
  return `http://${address}/graphql`;
}

function post(endpoint: string, body: string, headers: Record<string, string> = {}) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
    signal: AbortSignal.timeout(10_000),
  });
}

const typenameQuery = JSON.stringify({ query: '{ __typename }' });

describe('request id', () => {
  test('a response carries the first value of the x-request-id sent by the client', async () => {
    const response = await post(await graphqlEndpoint(), typenameQuery, {
      'x-request-id': 'abc, def',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('abc');
  });

  test('a response carries a generated id when the client sends none', async () => {
    const endpoint = await graphqlEndpoint();
    const [first, second] = await Promise.all([
      post(endpoint, typenameQuery),
      post(endpoint, typenameQuery),
    ]);

    const firstId = first.headers.get('x-request-id');
    const secondId = second.headers.get('x-request-id');
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  test('a request body over the size limit is rejected with the request id in the response', async () => {
    const body = JSON.stringify({
      query: '{ __typename }',
      variables: { pad: 'x'.repeat(25_000_001) },
    });
    const response = await post(await graphqlEndpoint(), body, {
      'x-request-id': 'too-large-request',
    });

    expect(response.status).toBe(413);
    expect(response.headers.get('x-request-id')).toBe('too-large-request');
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ extensions: { code: 'REQUEST_ENTITY_TOO_LARGE' } }],
    });
  });
});
