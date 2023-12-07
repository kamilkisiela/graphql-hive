import { afterAll, afterEach, beforeEach, expect, test } from 'vitest';
import { createSignatureValidator } from '../src/auth';
import '../src/dev-polyfill';
import { MockAgent, MockPool, setGlobalDispatcher } from 'undici';
import { InvalidRequestFormat, InvalidSignature, MissingSignature } from '../src/errors';
import { handleRequest } from '../src/handler';

const mockAgent = new MockAgent({
  keepAliveTimeout: 10, // milliseconds
  keepAliveMaxTimeout: 10, // milliseconds,
  connections: 1,
  pipelining: 0,
});
let mockPool: MockPool;
setGlobalDispatcher(mockAgent);

const SignatureValidators = {
  AlwaysTrue: () => true,
  AlwaysFalse: () => false,
  Real: createSignatureValidator,
};

function clearWorkerEnv() {
  Object.defineProperties(globalThis, {
    SIGNATURE: {
      value: undefined,
    },
  });
}

const logger = {
  info: () => {},
  error: () => {},
};

beforeEach(() => {
  mockPool = mockAgent.get('http://localhost:3000');
});
afterEach(clearWorkerEnv);
afterEach(async () => {
  await mockPool?.close();
  mockAgent.assertNoPendingInterceptors();
});

afterAll(() => mockAgent.close());

test('401 on missing signature', async () => {
  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response instanceof MissingSignature).toBeTruthy();
  expect(response.status).toBe(401);
});

test('403 on non-matching signature', async () => {
  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': '654321',
    },
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response instanceof InvalidSignature).toBeTruthy();
  expect(response.status).toBe(403);
});

test('405 allow only POST method', async () => {
  const SIGNATURE = '123456';

  let request = new Request('https://fake-worker.com/', {
    method: 'GET',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
  });

  let response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger, 'req-1');
  expect(response.status).toBe(405);

  request = new Request('https://fake-worker.com/', {
    method: 'PUT',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({}),
  });

  response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger, 'req-1');
  expect(response.status).toBe(405);
});

test('400 on invalid request format', async () => {
  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({}),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response instanceof InvalidRequestFormat).toBeTruthy();
  expect(response.status).toBe(400);
});

test('GET text/plain', async () => {
  mockPool!
    .intercept({
      path: '/webhook',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    })
    .reply(200, 'OK');

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/webhook',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('OK');
});

test('GET application/json', async () => {
  mockPool!
    .intercept({
      path: '/webhook',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    })
    .reply(200, { message: 'OK' });

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/webhook',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    JSON.stringify({
      message: 'OK',
    }),
  );
});

test('POST text/plain', async () => {
  mockPool!
    .intercept({
      path: '/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    })
    .reply(200, 'OK');

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('OK');
});

test('POST application/json', async () => {
  mockPool!
    .intercept({
      path: '/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    })
    .reply(200, { message: 'OK' });

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    JSON.stringify({
      message: 'OK',
    }),
  );
});

test('POST application/json + body', async () => {
  mockPool!
    .intercept({
      path: '/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    })
    .reply(opts => {
      return {
        statusCode: 200,
        data: {
          receivedBody: opts.body ?? '',
        },
      };
    });

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
      body: JSON.stringify({
        message: 'OK',
      }),
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    JSON.stringify({
      receivedBody: JSON.stringify({
        message: 'OK',
      }),
    }),
  );
});

test('POST application/json + body (without resolving body)', async () => {
  mockPool!
    .intercept({
      path: '/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    })
    .reply(opts => {
      return {
        statusCode: 200,
        data: opts.body ?? '',
      };
    });

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
      body: JSON.stringify({
        message: 'OK',
      }),
      // Turn off resolving body
      resolveResponseBody: false,
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toEqual(expect.stringMatching('resolveResponseBody: false'));
});

test('passthrough errors', async () => {
  mockPool!
    .intercept({
      path: '/error',
      method: 'GET',
    })
    .reply(500, 'Internal Server Error');

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost:3000/error',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    }),
  });

  const response = await handleRequest(
    request,
    SignatureValidators.Real(SIGNATURE),
    logger,
    'req-1',
  );
  expect(response.status).toBe(500);
  expect(await response.text()).toBe('Internal Server Error');
});
