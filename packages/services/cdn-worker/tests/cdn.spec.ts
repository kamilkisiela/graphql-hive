import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import '../src/dev-polyfill';
import { describe, expect, test } from 'vitest';
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
      async getArtifactAction(targetId, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'redirect',
              location: `target:${targetId}:${artifactType}`,
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
      async getArtifactAction(targetId, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'redirect',
              location: `target:${targetId}:${artifactType}`,
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
      async getArtifactAction(targetId, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'redirect',
              location: `target:${targetId}:${artifactType}`,
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
      async getArtifactAction(targetId, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'redirect',
              location: `target:${targetId}:${artifactType}`,
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
      async getArtifactAction(targetId, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'redirect',
              location: `target:${targetId}:${artifactType}`,
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
      async getArtifactAction(targetId, artifactType) {
        return map.has(`target:${targetId}:${artifactType}`)
          ? {
              type: 'redirect',
              location: `target:${targetId}:${artifactType}`,
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
        async getArtifactAction(targetId, artifactType) {
          return map.has(`target:${targetId}:${artifactType}`)
            ? {
                type: 'redirect',
                location: `target:${targetId}:${artifactType}`,
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
          s3: {
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
        }),
        async getArtifactAction(targetId, artifactType) {
          return map.has(`target:${targetId}:${artifactType}`)
            ? {
                type: 'redirect',
                location: `target:${targetId}:${artifactType}`,
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
          s3: {
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
});
