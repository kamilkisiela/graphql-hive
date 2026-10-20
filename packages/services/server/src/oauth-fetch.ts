type RequestBroker = {
  endpoint: string;
  signature: string;
};

export function createBrokerFetch(
  fetchImplementation: typeof fetch,
  requestBroker: RequestBroker | null,
) {
  return function brokerFetch(url: string, init: RequestInit): Promise<Response> {
    if (!requestBroker) {
      return fetchImplementation(url, init);
    }

    const method = init.method ?? 'GET';
    if (method !== 'GET' && method !== 'POST') {
      throw new Error(`The request broker does not support ${method} requests.`);
    }

    return fetchImplementation(requestBroker.endpoint, {
      method: 'POST',
      headers: {
        accept: 'text/plain',
        'content-type': 'application/json',
        'x-hive-signature': requestBroker.signature,
      },
      body: JSON.stringify({
        url,
        method,
        headers: init.headers,
        ...(method === 'POST'
          ? {
              body: init.body?.toString(),
              resolveResponseBody: true,
            }
          : {}),
      }),
    });
  };
}
