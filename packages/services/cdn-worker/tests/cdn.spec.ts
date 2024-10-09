import { createHmac } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import '../src/dev-polyfill';
import { MockAgent, MockPool, fetch as undiciFetch } from 'undici';
// eslint-disable-next-line import/no-extraneous-dependencies
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ArtifactStorageReader } from '../src/artifact-storage-reader';
import { AwsClient } from '../src/aws';
import { encodeCdnToken } from '../src/cdn-token';
import {
  InvalidArtifactTypeResponse,
  InvalidAuthKeyResponse,
  MissingAuthKeyResponse,
  MissingTargetIDErrorResponse,
} from '../src/errors';
import { createRequestHandler } from '../src/handler';
import { createIsKeyValid, KeyValidator } from '../src/key-validation';

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

  async function createV2Token(targetId: string) {
    const SECRET = '123456';
    const tokenKeyId = 'secret-key';
    const secret = createToken(SECRET, targetId);
    const key = encodeCdnToken({
      privateKey: secret,
      keyId: tokenKeyId,
    });

    const hash = await bcrypt.hash(secret, await bcrypt.genSalt());

    return {
      key,
      keyId: tokenKeyId,
      hash,
    };
  }

  test('in /schema and /metadata the response should contain content-type: application/json header', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:sdl`, `type Query { dummy: String }`);
    map.set(
      `target:${targetId}:services`,
      JSON.stringify([
        {
          sdl: `type Query { dummy: String }`,
          name: 'service1',
          url: 'http://localhost:4000',
        },
      ]),
    );
    map.set(`target:${targetId}:metadata`, JSON.stringify({ meta: true }));
    const token = createToken(SECRET, targetId);

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        analytics: null,
        breadcrumb: null,
        captureException: console.error,
        artifactStorageReader: new ArtifactStorageReader(
          {
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
          null,
          null,
          null,
        ),
      }),
      async getArtifactAction(targetId, _, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'response',
              status: 200,
              body: map.get(`target:${targetId}:${artifactType}`),
              headers: new Headers(),
            }
          : {
              type: 'notFound',
            };
      },
      async fetchText(url) {
        return map.get(url);
      },
    });

    const schemaRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });

    const schemaResponse = await handleRequest(schemaRequest);
    expect(schemaResponse.status).toBe(200);
    expect(schemaResponse.headers.get('content-type')).toBe('application/json');
    await expect(schemaResponse.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sdl: `type Query { dummy: String }`,
          name: 'service1',
          url: 'http://localhost:4000',
        }),
      ]),
    );

    const metadataRequest = new Request(`https://fake-worker.com/${targetId}/metadata`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });

    const metadataResponse = await handleRequest(metadataRequest);
    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.headers.get('content-type')).toBe('application/json');
    await expect(metadataResponse.json()).resolves.toEqual(
      expect.objectContaining({
        meta: true,
      }),
    );
  });

  test('etag + if-none-match for schema', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(
      `target:${targetId}:services`,
      JSON.stringify([{ sdl: `type Query { dummy: String }` }]),
    );

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        analytics: null,
        breadcrumb: null,
        captureException: console.error,
        artifactStorageReader: new ArtifactStorageReader(
          {
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
          null,
          null,
          null,
        ),
      }),
      async getArtifactAction(targetId, _, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'response',
              status: 200,
              headers: new Headers(),
              body: map.get(`target:${targetId}:${artifactType}`),
            }
          : {
              type: 'notFound',
            };
      },
      async fetchText(url) {
        return map.get(url);
      },
    });

    const token = createToken(SECRET, targetId);

    const firstRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await handleRequest(firstRequest);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sdl: `type Query { dummy: String }`,
        }),
      ]),
    );

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await handleRequest(secondRequest);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': '"non-existing-etag"',
      },
    });
    const wrongEtagResponse = await handleRequest(wrongEtagRequest);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sdl: `type Query { dummy: String }`,
        }),
      ]),
    );
  });

  test('etag + if-none-match for supergraph', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:supergraph`, `type Query { dummy: String }`);

    const token = createToken(SECRET, targetId);

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        analytics: null,
        breadcrumb: null,
        captureException: console.error,
        artifactStorageReader: new ArtifactStorageReader(
          {
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
          null,
          null,
          null,
        ),
      }),
      async getArtifactAction(targetId, _, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'response',
              status: 200,
              headers: new Headers(),
              body: map.get(`target:${targetId}:${artifactType}`),
            }
          : {
              type: 'notFound',
            };
      },
      async fetchText(url) {
        return map.get(url);
      },
    });

    const firstRequest = new Request(`https://fake-worker.com/${targetId}/supergraph`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await handleRequest(firstRequest);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.text()).resolves.toEqual(`type Query { dummy: String }`);

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/${targetId}/supergraph`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await handleRequest(secondRequest);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(`https://fake-worker.com/${targetId}/supergraph`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': '"non-existing-etag"',
      },
    });
    const wrongEtagResponse = await handleRequest(wrongEtagRequest);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.text()).resolves.toBe(`type Query { dummy: String }`);
  });

  test('etag + if-none-match for metadata', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:metadata`, JSON.stringify({ meta: true }));

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        analytics: null,
        breadcrumb: null,
        captureException: console.error,
        artifactStorageReader: new ArtifactStorageReader(
          {
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
          null,
          null,
          null,
        ),
      }),
      async getArtifactAction(targetId, _, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'response',
              status: 200,
              headers: new Headers(),
              body: map.get(`target:${targetId}:${artifactType}`),
            }
          : {
              type: 'notFound',
            };
      },
      async fetchText(url) {
        return map.get(url);
      },
    });

    const token = createToken(SECRET, targetId);

    const firstRequest = new Request(`https://fake-worker.com/${targetId}/metadata`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await handleRequest(firstRequest);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.json()).resolves.toEqual({
      meta: true,
    });

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/${targetId}/metadata`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await handleRequest(secondRequest);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(`https://fake-worker.com/${targetId}/metadata`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': '"non-existing-etag"',
      },
    });
    const wrongEtagResponse = await handleRequest(wrongEtagRequest);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.json()).resolves.toEqual({
      meta: true,
    });
  });

  test('etag + if-none-match for introspection', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:sdl`, `type Query { dummy: String }`);

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        analytics: null,
        breadcrumb: null,
        captureException: console.error,
        artifactStorageReader: new ArtifactStorageReader(
          {
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
          null,
          null,
          null,
        ),
      }),
      async getArtifactAction(targetId, _, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'response',
              status: 200,
              headers: new Headers(),
              body: map.get(`target:${targetId}:${artifactType}`),
            }
          : {
              type: 'notFound',
            };
      },
      async fetchText(url) {
        return map.get(url);
      },
    });

    const token = createToken(SECRET, targetId);

    const firstRequest = new Request(`https://fake-worker.com/${targetId}/introspection`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await handleRequest(firstRequest);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    // Make sure it's JSON
    await expect(firstResponse.json()).resolves.toEqual(expect.objectContaining({}));

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/${targetId}/introspection`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await handleRequest(secondRequest);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(`https://fake-worker.com/${targetId}/introspection`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': '"non-existing-etag"',
      },
    });
    const wrongEtagResponse = await handleRequest(wrongEtagRequest);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    // Make sure it's JSON
    await expect(wrongEtagResponse.json()).resolves.toEqual(expect.objectContaining({}));
  });

  test('etag + if-none-match for sdl', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:sdl`, `type Query { dummy: String }`);

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        analytics: null,
        breadcrumb: null,
        captureException: console.error,
        artifactStorageReader: new ArtifactStorageReader(
          {
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
          null,
          null,
          null,
        ),
      }),
      async getArtifactAction(targetId, _, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'response',
              status: 200,
              headers: new Headers(),
              body: map.get(`target:${targetId}:${artifactType}`),
            }
          : {
              type: 'notFound',
            };
      },
      async fetchText(url) {
        return map.get(url);
      },
    });

    const token = createToken(SECRET, targetId);

    const firstRequest = new Request(`https://fake-worker.com/${targetId}/sdl`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });
    const firstResponse = await handleRequest(firstRequest);
    const etag = firstResponse.headers.get('etag');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toBeDefined();
    // Every request receives the etag
    expect(etag).toBeDefined();
    await expect(firstResponse.text()).resolves.toEqual(`type Query { dummy: String }`);

    // Sending the etag in the if-none-match header should result in a 304
    const secondRequest = new Request(`https://fake-worker.com/${targetId}/sdl`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': etag!,
      },
    });
    const secondResponse = await handleRequest(secondRequest);
    expect(secondResponse.status).toBe(304);
    expect(secondResponse.body).toBeNull();

    // Sending the etag in the if-none-match header should result in a 304
    const wrongEtagRequest = new Request(`https://fake-worker.com/${targetId}/sdl`, {
      headers: {
        'x-hive-cdn-key': token,
        'if-none-match': '"non-existing-etag"',
      },
    });
    const wrongEtagResponse = await handleRequest(wrongEtagRequest);
    expect(wrongEtagResponse.status).toBe(200);
    expect(wrongEtagResponse.body).toBeDefined();
    await expect(wrongEtagResponse.text()).resolves.toEqual(`type Query { dummy: String }`);
  });

  describe('Basic parsing errors', () => {
    test('Should throw when target id is missing', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysTrue,
        async getArtifactAction() {
          return {
            type: 'notFound',
          };
        },
        async fetchText() {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/', {});

      const response = await handleRequest(request);
      expect(response instanceof MissingTargetIDErrorResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    test('Should throw when requested resource is not valid', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysTrue,
        async getArtifactAction() {
          return {
            type: 'notFound',
          };
        },
        async fetchText() {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/fake-target-id/error', {});

      const response = await handleRequest(request);
      expect(response instanceof InvalidArtifactTypeResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    test('Should throw when auth key is missing', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysTrue,
        async getArtifactAction() {
          return {
            type: 'notFound',
          };
        },
        async fetchText() {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/fake-target-id/sdl', {});

      const response = await handleRequest(request);
      expect(response instanceof MissingAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    test('Should throw when key validation function fails', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysFalse,
        async getArtifactAction() {
          return {
            type: 'notFound',
          };
        },
        async fetchText() {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/fake-target-id/sdl', {
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

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader: new ArtifactStorageReader(
            {
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
            null,
            null,
            null,
          ),
        }),
        async getArtifactAction(targetId, _, artifactType) {
          return map.has(`target:${targetId}:${artifactType}`)
            ? {
                type: 'response',
                status: 200,
                headers: new Headers(),
                body: map.get(`target:${targetId}:${artifactType}`),
              }
            : {
                type: 'notFound',
              };
        },
        async fetchText(url) {
          return map.get(url);
        },
      });

      const token = createToken(SECRET, targetId);

      const request = new Request(`https://fake-worker.com/${targetId}/sdl`, {
        headers: {
          'x-hive-cdn-key': token,
        },
      });

      const response = await handleRequest(request);
      expect(response.status).toBe(200);
    });

    test('Should throw on mismatch of token target and actual target', async () => {
      const SECRET = '123456';
      const map = new Map();

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader: new ArtifactStorageReader(
            {
              endpoint: 'http://localhost:1337',
              bucketName: 'artifacts',
              client: {
                async fetch() {
                  return new Response(null, {
                    status: 404,
                  });
                },
              } as any,
            },
            null,
            null,
            null,
          ),
        }),
        async getArtifactAction(targetId, _, artifactType) {
          return map.has(`target:${targetId}:${artifactType}`)
            ? {
                type: 'response',
                status: 200,
                headers: new Headers(),
                body: map.get(`target:${targetId}:${artifactType}`),
              }
            : {
                type: 'notFound',
              };
        },
        async fetchText(url) {
          return map.get(url);
        },
      });

      const token = createToken(SECRET, 'fake-target-id');

      const request = new Request(`https://fake-worker.com/some-other-target/sdl`, {
        headers: {
          'x-hive-cdn-key': token,
        },
      });

      const response = await handleRequest(request);
      expect(response instanceof InvalidAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(403);
    });

    test('Should throw on invalid token hash', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader: new ArtifactStorageReader(
            {
              endpoint: 'http://localhost:1337',
              bucketName: 'artifacts',
              client: {
                async fetch() {
                  return new Response(await bcrypt.hash('foobars', await bcrypt.genSalt()), {
                    status: 200,
                  });
                },
              } as any,
            },
            null,
            null,
            null,
          ),
        }),
        async getArtifactAction() {
          return {
            type: 'notFound',
          };
        },
        async fetchText() {
          throw new Error('Should not be called');
        },
      });

      const request = new Request(`https://fake-worker.com/some-target/sdl`, {
        headers: {
          'x-hive-cdn-key': 'i-like-turtles',
        },
      });

      const response = await handleRequest(request);
      expect(response instanceof InvalidAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(403);
    });
  });

  describe('use S3', () => {
    const mockAgent = new MockAgent();
    let r2MockPool: MockPool;
    let s3MockPool: MockPool;
    const r2Endpoint = 'http://localhost:3002';
    const s3Endpoint = 'http://localhost:3003';

    const TIMEOUT = 200;
    const DELAY = TIMEOUT + 100;

    const mockedFetch = (input: any, init?: any) => {
      // Use undici's fetch with custom dispatcher to mock the network
      return undiciFetch(input as any, {
        ...(init ?? {}),
        dispatcher: mockAgent,
      }) as Promise<Response>;
    };

    beforeEach(() => {
      r2MockPool = mockAgent.get(r2Endpoint);
      s3MockPool = mockAgent.get(s3Endpoint);
    });

    afterEach(async () => {
      await r2MockPool?.close();
      await s3MockPool?.close();
      mockAgent.assertNoPendingInterceptors();
    });
    afterAll(() => mockAgent.close());

    test('when fetching access key from R2 takes longer than a timeout', async () => {
      const targetId = 'fake-target-id';
      const services = [{ sdl: `type Query { dummy: String }` }];

      const access = await createV2Token(targetId);

      // Fetching the key from R2 takes longer than the timeout
      r2MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/cdn-keys/${targetId}/${access.keyId}`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: access.hash,
          };
        })
        .delay(DELAY);

      s3MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/cdn-keys/${targetId}/${access.keyId}`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: access.hash,
          };
        });

      s3MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/artifact/${targetId}/services`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: JSON.stringify(services),
          };
        });

      const artifactStorageReader = new ArtifactStorageReader(
        {
          endpoint: r2Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 'r2-fake-access-key',
            secretAccessKey: 'r2-fake-secret-key',
            sessionToken: 'r2-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        {
          endpoint: s3Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 's3-fake-access-key',
            secretAccessKey: 's3-fake-secret-key',
            sessionToken: 's3-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        null,
        null,
        TIMEOUT,
      );

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader,
        }),
        async getArtifactAction(targetId, contractName, artifactType, eTag) {
          return artifactStorageReader.readArtifact(targetId, contractName, artifactType, eTag);
        },
        async fetchText(url) {
          return mockedFetch(url).then(r => {
            if (r.ok) {
              return r.text();
            }

            throw new Error(`Failed to fetch ${url}, status: ${r.status}`);
          });
        },
      });

      const firstRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
        headers: {
          'x-hive-cdn-key': access.key,
        },
      });

      const response = await handleRequest(firstRequest);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([{ sdl: `type Query { dummy: String }` }]);
    });

    test('when fetching artifact from R2 takes longer than a timeout', async () => {
      const targetId = 'fake-target-id';
      const services = [{ sdl: `type Query { dummy: String }` }];

      const access = await createV2Token(targetId);

      // Fetching the key is instant
      r2MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/cdn-keys/${targetId}/${access.keyId}`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: access.hash,
          };
        });

      // Fetching the artifact from R2 takes longer than the timeout
      r2MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/artifact/${targetId}/services`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: JSON.stringify(services),
          };
        })
        .delay(DELAY);

      s3MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/artifact/${targetId}/services`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: JSON.stringify(services),
          };
        });

      const artifactStorageReader = new ArtifactStorageReader(
        {
          endpoint: r2Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 'r2-fake-access-key',
            secretAccessKey: 'r2-fake-secret-key',
            sessionToken: 'r2-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        {
          endpoint: s3Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 's3-fake-access-key',
            secretAccessKey: 's3-fake-secret-key',
            sessionToken: 's3-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        null,
        null,
        TIMEOUT,
      );

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader,
        }),
        async getArtifactAction(targetId, contractName, artifactType, eTag) {
          return artifactStorageReader.readArtifact(targetId, contractName, artifactType, eTag);
        },
        async fetchText(url) {
          return mockedFetch(url).then(r => {
            if (r.ok) {
              return r.text();
            }

            throw new Error(`Failed to fetch ${url}, status: ${r.status}`);
          });
        },
      });

      const firstRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
        headers: {
          'x-hive-cdn-key': access.key,
        },
      });

      const response = await handleRequest(firstRequest);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([{ sdl: `type Query { dummy: String }` }]);
    });

    test('when R2 is down and access key fails to be fetched', async () => {
      const targetId = 'fake-target-id';
      const services = [{ sdl: `type Query { dummy: String }` }];

      const access = await createV2Token(targetId);

      // R2 is down and we fail to fetch the key
      r2MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/cdn-keys/${targetId}/${access.keyId}`);
          },
        })
        .reply(() => {
          return {
            statusCode: 500,
            data: 'Please try again later',
          };
        });

      s3MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/cdn-keys/${targetId}/${access.keyId}`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: access.hash,
          };
        });

      s3MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/artifact/${targetId}/services`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: JSON.stringify(services),
          };
        });

      const artifactStorageReader = new ArtifactStorageReader(
        {
          endpoint: r2Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 'r2-fake-access-key',
            secretAccessKey: 'r2-fake-secret-key',
            sessionToken: 'r2-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        {
          endpoint: s3Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 's3-fake-access-key',
            secretAccessKey: 's3-fake-secret-key',
            sessionToken: 's3-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        null,
        null,
      );

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader,
        }),
        async getArtifactAction(targetId, contractName, artifactType, eTag) {
          return artifactStorageReader.readArtifact(targetId, contractName, artifactType, eTag);
        },
        async fetchText(url) {
          return mockedFetch(url).then(r => {
            if (r.ok) {
              return r.text();
            }

            throw new Error(`Failed to fetch ${url}, status: ${r.status}`);
          });
        },
      });

      const firstRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
        headers: {
          'x-hive-cdn-key': access.key,
        },
      });

      const response = await handleRequest(firstRequest);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([{ sdl: `type Query { dummy: String }` }]);
    });

    test('when R2 is down after we got the access key', async () => {
      const targetId = 'fake-target-id';
      const services = [{ sdl: `type Query { dummy: String }` }];

      const access = await createV2Token(targetId);

      // R2 is down and we fail to fetch the key
      r2MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/cdn-keys/${targetId}/${access.keyId}`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: access.hash,
          };
        });

      r2MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/artifact/${targetId}/services`);
          },
        })
        .reply(() => {
          return {
            statusCode: 500,
            data: 'We are so down',
          };
        });

      s3MockPool
        .intercept({
          path(path) {
            return path.startsWith(`/artifacts/artifact/${targetId}/services`);
          },
        })
        .reply(() => {
          return {
            statusCode: 200,
            data: JSON.stringify(services),
          };
        });

      const artifactStorageReader = new ArtifactStorageReader(
        {
          endpoint: r2Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 'r2-fake-access-key',
            secretAccessKey: 'r2-fake-secret-key',
            sessionToken: 'r2-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        {
          endpoint: s3Endpoint,
          bucketName: 'artifacts',
          client: new AwsClient({
            accessKeyId: 's3-fake-access-key',
            secretAccessKey: 's3-fake-secret-key',
            sessionToken: 's3-fake-session-token',
            service: 's3',
            fetch: mockedFetch,
          }),
        },
        null,
        null,
      );

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          analytics: null,
          breadcrumb: null,
          captureException: console.error,
          artifactStorageReader,
        }),
        async getArtifactAction(targetId, contractName, artifactType, eTag) {
          return artifactStorageReader.readArtifact(targetId, contractName, artifactType, eTag);
        },
        async fetchText(url) {
          return mockedFetch(url).then(r => {
            if (r.ok) {
              return r.text();
            }

            throw new Error(`Failed to fetch ${url}, status: ${r.status}`);
          });
        },
      });

      const firstRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
        headers: {
          'x-hive-cdn-key': access.key,
        },
      });

      const response = await handleRequest(firstRequest);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([{ sdl: `type Query { dummy: String }` }]);
    });
  });
});
