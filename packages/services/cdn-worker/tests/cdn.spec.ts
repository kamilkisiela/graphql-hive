import { createHash, createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import '../src/dev-polyfill';
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { createArtifactRequestHandler, GetArtifactActionFn } from '../src/artifact-handler';
import {
  CDNArtifactNotFound,
  InvalidArtifactTypeResponse,
  InvalidAuthKeyResponse,
  MissingAuthKeyResponse,
} from '../src/errors';
import { createIsKeyValid, KeyValidator } from '../src/key-validation';

function createGetArtifactAction(map: Map<string, string>): GetArtifactActionFn {
  return async function getArtifactAction(
    targetId: string,
    artifactType: string,
    etagFromIfNoneMatch: string | null,
  ) {
    const value = map.get(`target:${targetId}:${artifactType}`);

    if (value) {
      const etag = createEtag(value);

      if (etag === etagFromIfNoneMatch) {
        return {
          type: 'notModified',
        };
      }

      return {
        type: 'redirect',
        location: {
          public: `target:${targetId}:${artifactType}`,
          private: `target:${targetId}:${artifactType}`,
        },
      };
    }

    return {
      type: 'notFound',
    };
  };
}

function createMockedArtifactRequestHandler({
  token,
  map,
}: {
  token: string;
  map: Map<string, string>;
}) {
  return createArtifactRequestHandler({
    isKeyValid: createIsKeyValid({
      getCache: null,
      waitUntil: null,
      analytics: null,
      s3: {
        endpoint: 'http://localhost:1337',
        bucketName: 'artifacts',
        client: {
          async fetch() {
            return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
              status: 200,
            });
          },
        } as any,
      },
    }),
    getArtifactAction: createGetArtifactAction(map),
  });
}

function createEtag(value: string) {
  return createHash('md5').update(value).digest('hex');
}

async function followRedirects(responsePromise: Promise<Response>, map: Map<string, string>) {
  const response = await responsePromise;
  if (response.status === 302) {
    expect(response.headers.get('location')).toBeDefined();

    const value = map.get(response.headers.get('location')!);

    if (value) {
      response.headers.set('etag', createEtag(value));
      return new Response(value, {
        headers: response.headers,
        status: 200,
      });
    }

    return new Response(null, { status: 404 });
  }

  return response;
}

describe('CDN Worker', () => {
  const KeyValidators: Record<string, KeyValidator> = {
    AlwaysTrue: () => Promise.resolve(true),
    AlwaysFalse: () => Promise.resolve(false),
  };

  function createToken(secret: string, targetId: string): string {
    const encoder = new TextEncoder();
    const secretKeyData = encoder.encode(secret);

    return createHmac('sha256', secretKeyData).update(encoder.encode(targetId)).digest('base64');
  }

  test('etag + if-none-match for supergraph', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:supergraph`, `type Query { dummy: String }`);

    const token = createToken(SECRET, targetId);

    const handleRequest = createMockedArtifactRequestHandler({ token, map });

    const firstRequest = new Request(
      `https://fake-worker.com/artifacts/v1/${targetId}/supergraph`,
      {
        headers: {
          'x-hive-cdn-key': token,
        },
      },
    );
    const firstResponse = await followRedirects(handleRequest(firstRequest), map);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.text()).resolves.toEqual(`type Query { dummy: String }`);

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(
      `https://fake-worker.com/artifacts/v1/${targetId}/supergraph`,
      {
        headers: {
          'x-hive-cdn-key': token,
          'if-none-match': etag!,
        },
      },
    );
    const secondResponse = await followRedirects(handleRequest(secondRequest), map);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(
      `https://fake-worker.com/artifacts/v1/${targetId}/supergraph`,
      {
        headers: {
          'x-hive-cdn-key': token,
          'if-none-match': '"non-existing-etag"',
        },
      },
    );
    const wrongEtagResponse = await followRedirects(handleRequest(wrongEtagRequest), map);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.text()).resolves.toBe(`type Query { dummy: String }`);
  });

  test('etag + if-none-match for sdl', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const token = createToken(SECRET, targetId);
    const map = new Map();
    map.set(`target:${targetId}:sdl`, `type Query { dummy: String }`);

    const handleRequest = createMockedArtifactRequestHandler({
      token,
      map,
    });

    const firstRequest = new Request(`https://fake-worker.com/artifacts/v1/${targetId}/sdl`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await followRedirects(handleRequest(firstRequest), map);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.text()).resolves.toEqual(`type Query { dummy: String }`);

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/artifacts/v1/${targetId}/sdl`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await followRedirects(handleRequest(secondRequest), map);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(`https://fake-worker.com/artifacts/v1/${targetId}/sdl`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': '"non-existing-etag"',
      },
    });
    const wrongEtagResponse = await followRedirects(handleRequest(wrongEtagRequest), map);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.text()).resolves.toEqual(`type Query { dummy: String }`);
  });

  test('etag + if-none-match for services', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const token = createToken(SECRET, targetId);
    const map = new Map();
    map.set(
      `target:${targetId}:services`,
      JSON.stringify([
        {
          sdl: `type Query { dummy: String }`,
          name: 'foo',
        },
      ]),
    );

    const handleRequest = createMockedArtifactRequestHandler({
      token,
      map,
    });

    const firstRequest = new Request(`https://fake-worker.com/artifacts/v1/${targetId}/services`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await followRedirects(handleRequest(firstRequest), map);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.text()).resolves.toEqual(
      JSON.stringify([
        {
          sdl: `type Query { dummy: String }`,
          name: 'foo',
        },
      ]),
    );

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/artifacts/v1/${targetId}/services`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await followRedirects(handleRequest(secondRequest), map);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(
      `https://fake-worker.com/artifacts/v1/${targetId}/services`,
      {
        headers: {
          'x-hive-cdn-key': token,
          'if-none-match': '"non-existing-etag"',
        },
      },
    );
    const wrongEtagResponse = await followRedirects(handleRequest(wrongEtagRequest), map);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.text()).resolves.toEqual(
      JSON.stringify([
        {
          sdl: `type Query { dummy: String }`,
          name: 'foo',
        },
      ]),
    );
  });

  describe('Basic parsing errors', () => {
    test('Should throw when requested resource is not valid', async () => {
      const handleRequest = createMockedArtifactRequestHandler({
        token: 'foo',
        map: new Map(),
      });
      const request = new Request('https://fake-worker.com/artifacts/v1/fake-target-id/error', {});
      const response = await handleRequest(request);
      expect(response instanceof InvalidArtifactTypeResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    test('Should throw when auth key is missing', async () => {
      const handleRequest = createMockedArtifactRequestHandler({
        token: 'foo',
        map: new Map(),
      });
      const request = new Request('https://fake-worker.com/artifacts/v1/fake-target-id/sdl', {});
      const response = await handleRequest(request);
      expect(response instanceof MissingAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    test('Should throw when key validation function fails', async () => {
      const handleRequest = createMockedArtifactRequestHandler({
        map: new Map(),
        token: 'foo',
      });
      const request = new Request('https://fake-worker.com/artifacts/v1/fake-target-id/sdl', {
        headers: {
          'x-hive-cdn-key': 'some-key',
        },
      });
      const response = await handleRequest(request);
      expect(response instanceof InvalidAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(403);
    });
  });

  describe('Authentication', () => {
    test('Should accept valid auth token', async () => {
      const SECRET = '123456';
      const targetId = 'fake-target-id';
      const map = new Map();
      map.set(`target:${targetId}:sdl`, `type Query { dummy: String }`);
      const handleRequest = createMockedArtifactRequestHandler({
        token: createToken(SECRET, targetId),
        map,
      });
      const token = createToken(SECRET, targetId);
      const request = new Request(`https://fake-worker.com/artifacts/v1/${targetId}/sdl`, {
        headers: {
          'x-hive-cdn-key': token,
        },
      });
      const response = await followRedirects(handleRequest(request), map);
      expect(response.status).toBe(200);
    });

    test('Should throw on mismatch of token target and actual target', async () => {
      const SECRET = '123456';
      const token = createToken(SECRET, 'fake-target-id');
      const map = new Map();
      const handleRequest = createMockedArtifactRequestHandler({
        token,
        map,
      });
      const request = new Request(`https://fake-worker.com/artifacts/v1/some-other-target/sdl`, {
        headers: {
          'x-hive-cdn-key': token,
        },
      });
      const response = await followRedirects(handleRequest(request), map);
      expect(response instanceof CDNArtifactNotFound).toBeTruthy();
      expect(response.status).toBe(404);
    });

    test('Should throw on invalid token hash', async () => {
      const handleRequest = createMockedArtifactRequestHandler({
        token: createToken('123456', 'fake-target-id'),
        map: new Map(),
      });
      const request = new Request(`https://fake-worker.com/artifacts/v1/some-target/sdl`, {
        headers: {
          'x-hive-cdn-key': 'i-like-turtles',
        },
      });
      const response = await handleRequest(request);
      expect(response instanceof InvalidAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(403);
    });
  });
});
