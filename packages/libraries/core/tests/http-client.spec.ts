import { makeFetchCall } from '../src/client/http-client';
import { createHiveTestingLogger } from './test-utils';

test('HTTP call without retries and system level error', async () => {
  const logger = createHiveTestingLogger();
  const response = await makeFetchCall('https://ap.localhost.noop', {
    method: 'GET',
    retry: false,
    headers: {},
    logger,
  }).catch(_ => {});

  if (response) {
    throw new Error('Should have rejected.');
  }

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] GET https://ap.localhost.noop
    [ERR] Error: getaddrinfo ENOTFOUND ap.localhost.noop
    [ERR] GET https://ap.localhost.noop failed (666ms). getaddrinfo ENOTFOUND ap.localhost.noop
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
  }).catch(_ => {});

  expect(logger.getLogs()).toMatchInlineSnapshot(`
    [INF] GET https://ap.localhost.noop Attempt (1/2)
    [ERR] Error: getaddrinfo ENOTFOUND ap.localhost.noop
    [ERR] GET https://ap.localhost.noop failed (666ms). getaddrinfo ENOTFOUND ap.localhost.noop
    [INF] GET https://ap.localhost.noop Attempt (2/2)
    [ERR] Error: getaddrinfo ENOTFOUND ap.localhost.noop
    [ERR] GET https://ap.localhost.noop failed (666ms). getaddrinfo ENOTFOUND ap.localhost.noop
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
    [INF] GET https://ap.localhost.noop Attempt (1/2)
    [ERR] GET https://ap.localhost.noop failed with status 404 (666ms): Bubatzbieber
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
    [INF] GET https://ap.localhost.noop Attempt (1/2)
    [ERR] GET https://ap.localhost.noop failed with status 500 (666ms): Bubatzbieber
    [INF] GET https://ap.localhost.noop Attempt (2/2)
    [ERR] GET https://ap.localhost.noop failed with status 500 (666ms): Bubatzbieber
    [ERR] GET https://ap.localhost.noop retry limit exceeded after 2 attempts.
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
    [INF] GET https://ap.localhost.noop Attempt (1/2)
    [ERR] GET https://ap.localhost.noop failed with status 302 (666ms): Bubatzbieber
    [INF] GET https://ap.localhost.noop Attempt (2/2)
    [ERR] GET https://ap.localhost.noop failed with status 302 (666ms): Bubatzbieber
    [ERR] GET https://ap.localhost.noop retry limit exceeded after 2 attempts.
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
    [INF] GET https://ap.localhost.noop Attempt (1/2)
    [INF] GET https://ap.localhost.noop succeeded with status 302 (666ms).
  `);
});
