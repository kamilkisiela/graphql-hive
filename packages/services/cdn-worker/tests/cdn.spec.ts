import { createHmac } from 'crypto';
import * as bcrypt from 'bcryptjs';
import '../src/dev-polyfill';
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
    map.set(`target:${targetId}:sdl`, JSON.stringify({ sdl: `type Query { dummy: String }` }));
    const token = createToken(SECRET, targetId);

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        s3: {
          endpoint: 'http://localhost:1337',
          bucketName: 'artifacts',
          client: {
            async fetch() {
              return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                status: 200,
              });
            },
          },
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

    const metadataRequest = new Request(`https://fake-worker.com/${targetId}/schema`, {
      headers: {
        'x-hive-cdn-key': token,
      },
    });

    const metadataResponse = await handleRequest(metadataRequest);
    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.headers.get('content-type')).toBe('application/json');
  });

  test('etag + if-none-match for schema', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:sdl`, JSON.stringify({ sdl: `type Query { dummy: String }` }));

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        s3: {
          endpoint: 'http://localhost:1337',
          bucketName: 'artifacts',
          client: {
            async fetch() {
              return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                status: 200,
              });
            },
          },
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
  });

  test('etag + if-none-match for supergraph', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(
      `target:${targetId}:supergraph`,
      JSON.stringify({ sdl: `type Query { dummy: String }` }),
    );

    const token = createToken(SECRET, targetId);

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        s3: {
          endpoint: 'http://localhost:1337',
          bucketName: 'artifacts',
          client: {
            async fetch() {
              return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                status: 200,
              });
            },
          },
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
  });

  test('etag + if-none-match for metadata', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:metadata`, JSON.stringify({ sdl: `type Query { dummy: String }` }));

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        s3: {
          endpoint: 'http://localhost:1337',
          bucketName: 'artifacts',
          client: {
            async fetch() {
              return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                status: 200,
              });
            },
          },
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
  });

  test('etag + if-none-match for introspection', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(`target:${targetId}:sdl`, JSON.stringify({ sdl: `type Query { dummy: String }` }));

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        s3: {
          endpoint: 'http://localhost:1337',
          bucketName: 'artifacts',
          client: {
            async fetch() {
              return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                status: 200,
              });
            },
          },
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
  });

  test('etag + if-none-match for sdl', async () => {
    const SECRET = '123456';
    const targetId = 'fake-target-id';
    const map = new Map();
    map.set(
      `target:${targetId}:sdl`,
      JSON.stringify({
        sdl: `type Query { dummy: String }`,
      }),
    );

    const handleRequest = createRequestHandler({
      isKeyValid: createIsKeyValid({
        getCache: null,
        waitUntil: null,
        s3: {
          endpoint: 'http://localhost:1337',
          bucketName: 'artifacts',
          client: {
            async fetch() {
              return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                status: 200,
              });
            },
          },
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
  });

  describe('Basic parsing errors', () => {
    it('Should throw when target id is missing', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysTrue,
        async getArtifactAction(targetId, artifactType) {
          return {
            type: 'notFound',
          };
        },
        async fetchText(url) {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/', {});

      const response = await handleRequest(request);
      expect(response instanceof MissingTargetIDErrorResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    it('Should throw when requested resource is not valid', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysTrue,
        async getArtifactAction(targetId, artifactType) {
          return {
            type: 'notFound',
          };
        },
        async fetchText(url) {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/fake-target-id/error', {});

      const response = await handleRequest(request);
      expect(response instanceof InvalidArtifactTypeResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    it('Should throw when auth key is missing', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysTrue,
        async getArtifactAction(targetId, artifactType) {
          return {
            type: 'notFound',
          };
        },
        async fetchText(url) {
          throw new Error('Should not be called');
        },
      });

      const request = new Request('https://fake-worker.com/fake-target-id/sdl', {});

      const response = await handleRequest(request);
      expect(response instanceof MissingAuthKeyResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    it('Should throw when key validation function fails', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: KeyValidators.AlwaysFalse,
        async getArtifactAction(targetId, artifactType) {
          return {
            type: 'notFound',
          };
        },
        async fetchText(url) {
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
    it('Should accept valid auth token', async () => {
      const SECRET = '123456';
      const targetId = 'fake-target-id';
      const map = new Map();
      map.set(`target:${targetId}:sdl`, JSON.stringify({ sdl: `type Query { dummy: String }` }));

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          s3: {
            endpoint: 'http://localhost:1337',
            bucketName: 'artifacts',
            client: {
              async fetch() {
                return new Response(await bcrypt.hash(token, await bcrypt.genSalt()), {
                  status: 200,
                });
              },
            },
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

    it('Should throw on mismatch of token target and actual target', async () => {
      const SECRET = '123456';
      const map = new Map();

      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          s3: {
            endpoint: 'http://localhost:1337',
            bucketName: 'artifacts',
            client: {
              async fetch() {
                return new Response(null, {
                  status: 404,
                });
              },
            },
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

    it('Should throw on invalid token hash', async () => {
      const handleRequest = createRequestHandler({
        isKeyValid: createIsKeyValid({
          getCache: null,
          waitUntil: null,
          s3: {
            endpoint: 'http://localhost:1337',
            bucketName: 'artifacts',
            client: {
              async fetch() {
                return new Response(await bcrypt.hash('foobars', await bcrypt.genSalt()), {
                  status: 200,
                });
              },
            },
          },
        }),
        async getArtifactAction(targetId, artifactType) {
          return {
            type: 'notFound',
          };
        },
        async fetchText(url) {
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
