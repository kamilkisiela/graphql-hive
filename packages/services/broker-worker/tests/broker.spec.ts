import nock from 'nock';
import { createSignatureValidator } from '../src/auth';
import '../src/dev-polyfill';
import { InvalidRequestFormat, InvalidSignature, MissingSignature } from '../src/errors';
import { handleRequest } from '../src/handler';

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

afterEach(clearWorkerEnv);
afterEach(nock.cleanAll);

test('401 on missing signature', async () => {
  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
  });

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
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

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
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

  let response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(405);

  request = new Request('https://fake-worker.com/', {
    method: 'PUT',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({}),
  });

  response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
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

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response instanceof InvalidRequestFormat).toBeTruthy();
  expect(response.status).toBe(400);
});

test('GET text/plain', async () => {
  nock('http://localhost')
    .get('/webhook')
    .once()
    .matchHeader('X-Key', 'key')
    .matchHeader('accept', 'text/plain')
    .reply(200, 'OK');

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost/webhook',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    }),
  });

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('OK');
});

test('GET application/json', async () => {
  nock('http://localhost')
    .get('/webhook')
    .once()
    .matchHeader('X-Key', 'key')
    .matchHeader('accept', 'application/json')
    .reply(200, {
      message: 'OK',
    });

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost/webhook',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    }),
  });

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    JSON.stringify({
      message: 'OK',
    }),
  );
});

test('POST text/plain', async () => {
  nock('http://localhost')
    .post('/webhook')
    .once()
    .matchHeader('X-Key', 'key')
    .matchHeader('accept', 'text/plain')
    .reply(200, 'OK');

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    }),
  });

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('OK');
});

test('POST application/json', async () => {
  nock('http://localhost')
    .post('/webhook')
    .once()
    .matchHeader('X-Key', 'key')
    .matchHeader('accept', 'application/json')
    .reply(200, {
      message: 'OK',
    });

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost/webhook',
      method: 'POST',
      headers: {
        'X-Key': 'key',
        accept: 'application/json',
      },
    }),
  });

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    JSON.stringify({
      message: 'OK',
    }),
  );
});

test('POST application/json + body', async () => {
  nock('http://localhost')
    .post('/webhook')
    .once()
    .matchHeader('X-Key', 'key')
    .matchHeader('accept', 'application/json')
    .reply((_, requestBody) => [
      200,
      {
        receivedBody: requestBody,
      },
    ]);

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost/webhook',
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

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(
    JSON.stringify({
      receivedBody: JSON.stringify({
        message: 'OK',
      }),
    }),
  );
});

test('passthrough errors', async () => {
  nock('http://localhost').get('/error').once().reply(500, 'Internal Server Error');

  const SIGNATURE = '123456';

  const request = new Request('https://fake-worker.com/', {
    method: 'POST',
    headers: {
      'x-hive-signature': SIGNATURE,
    },
    body: JSON.stringify({
      url: 'http://localhost/error',
      method: 'GET',
      headers: {
        'X-Key': 'key',
        accept: 'text/plain',
      },
    }),
  });

  const response = await handleRequest(request, SignatureValidators.Real(SIGNATURE), logger);
  expect(response.status).toBe(500);
  expect(await response.text()).toBe('Internal Server Error');
});
