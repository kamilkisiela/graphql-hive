import { HTTPResponseError, makeFetchCall } from '../src/client/http-client';
import { createHiveTestingLogger, fastFetchError } from './test-utils';

test('HTTP call without retries and system level error', async () => {
  const logger = createHiveTestingLogger();
  const response = await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: false,
    headers: {},
    logger,
    fetchImplementation: fastFetchError,
  }).catch(_ => {});

  if (response) {
    throw new Error('Should have rejected.');
  }

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    [ERR] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed (666ms). getaddrinfo ENOTFOUND ap.localhost.noop
  `);
});

test('HTTP with retries and system', async () => {
  const logger = createHiveTestingLogger();
  await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: {
      retries: 1,
    },
    headers: {},
    logger,
    fetchImplementation: fastFetchError,
  }).catch(_ => {});

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed (666ms). getaddrinfo ENOTFOUND ap.localhost.noop
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (2/2)
    [ERR] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed (666ms). getaddrinfo ENOTFOUND ap.localhost.noop
  `);
});

test('HTTP with 4xx status code will not be retried', async () => {
  const logger = createHiveTestingLogger();
  await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: {
      retries: 1,
    },
    headers: {},
    logger,
    fetchImplementation: async () => {
      return new Response('Bubatzbieber', {
        status: 404,
        statusText: 'Not Found',
      });
    },
  }).catch(_ => {});

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed with status 404 (666ms): Bubatzbieber
    [ERR] Abort retry because of status code 404.
  `);
});

test('HTTP with 5xx status code will be retried', async () => {
  const logger = createHiveTestingLogger();

  await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: {
      retries: 1,
    },
    headers: {},
    logger,
    fetchImplementation: async () => {
      return new Response('Bubatzbieber', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    },
  }).catch(_ => {});

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed with status 500 (666ms): Bubatzbieber
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (2/2)
    [ERR] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed with status 500 (666ms): Bubatzbieber
    [ERR] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) retry limit exceeded after 2 attempts.
  `);
});

test('HTTP with status 3xx will be retried', async () => {
  const logger = createHiveTestingLogger();

  await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: {
      retries: 1,
    },
    headers: {},
    logger,
    fetchImplementation: async () => {
      return new Response('Bubatzbieber', {
        status: 302,
        statusText: 'Found',
      });
    },
  }).catch(_ => {});

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed with status 302 (666ms): Bubatzbieber
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (2/2)
    [ERR] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) failed with status 302 (666ms): Bubatzbieber
    [ERR] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) retry limit exceeded after 2 attempts.
  `);
});

test('HTTP with status 3xx will not be retried with custom "isRequestOk" implementation', async () => {
  const logger = createHiveTestingLogger();

  await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: {
      retries: 1,
    },
    headers: {},
    logger,
    fetchImplementation: async () => {
      return new Response('Bubatzbieber', {
        status: 302,
        statusText: 'Found',
      });
    },
    isRequestOk: response => response.status === 302,
  }).catch(_ => {});

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) Attempt (1/2)
    [DBG] GET https://ap.localhost.noop (x-request-id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) succeeded with status 302 (666ms).
  `);
});

test('HTTP error for an unaccepted status code exposes the status', async () => {
  const error = await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: false,
    headers: {},
    logger: createHiveTestingLogger(),
    fetchImplementation: async () => {
      return new Response('Forbidden', {
        status: 403,
        statusText: 'Forbidden',
      });
    },
  }).then(
    () => null,
    error => error,
  );

  expect(error).toBeInstanceOf(HTTPResponseError);
  expect(error).toMatchObject({ status: 403, statusText: 'Forbidden' });
});

test('HTTP error carries the request id returned by the server', async () => {
  const error = await makeFetchCall('https://ap.localhost.noop', {
    method: 'POST',
    retry: false,
    headers: {},
    logger: createHiveTestingLogger(),
    fetchImplementation: async () =>
      new Response('too large', {
        status: 413,
        statusText: 'Payload Too Large',
        headers: { 'x-request-id': 'server-request-id' },
      }),
  }).then(
    () => null,
    (error: unknown) => error,
  );

  expect(error).toBeInstanceOf(HTTPResponseError);
  expect((error as HTTPResponseError).requestId).toBe('server-request-id');
});
