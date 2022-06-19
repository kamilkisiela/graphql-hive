import '../src/dev-polyfill';
import { handleRequest } from '../src/handler';
import {
  InvalidArtifactTypeResponse,
  InvalidAuthKey,
  MissingAuthKey,
  MissingTargetIDErrorResponse,
} from '../src/errors';
import { isKeyValid } from '../src/auth';
import { createHmac } from 'crypto';

describe('CDN Worker', () => {
  const KeyValidators: Record<string, typeof isKeyValid> = {
    AlwaysTrue: () => Promise.resolve(true),
    AlwaysFalse: () => Promise.resolve(false),
    Bcrypt: isKeyValid,
  };

  function mockWorkerEnv(input: { HIVE_DATA: Map<string, string>; KEY_DATA: string }) {
    (globalThis as any).HIVE_DATA = input.HIVE_DATA;
    (globalThis as any).KEY_DATA = input.KEY_DATA;
  }

  function clearWorkerEnv() {
    delete (globalThis as any).HIVE_DATA;
    delete (globalThis as any).KEY_DATA;
  }

  function createToken(secret: string, targetId: string): string {
    const encoder = new TextEncoder();
    const secretKeyData = encoder.encode(secret);

    return createHmac('sha256', secretKeyData).update(encoder.encode(targetId)).digest('base64');
  }

  afterEach(clearWorkerEnv);

  describe('Basic parsing errors', () => {
    it('Should throw when target id is missing', async () => {
      mockWorkerEnv({
        HIVE_DATA: new Map(),
        KEY_DATA: '',
      });

      const request = new Request('https://fake-worker.com/', {});

      const response = await handleRequest(request, KeyValidators.AlwaysTrue);
      expect(response instanceof MissingTargetIDErrorResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    it('Should throw when requested resource is not valid', async () => {
      mockWorkerEnv({
        HIVE_DATA: new Map(),
        KEY_DATA: '',
      });

      const request = new Request('https://fake-worker.com/fake-target-id/error', {});

      const response = await handleRequest(request, KeyValidators.AlwaysTrue);
      expect(response instanceof InvalidArtifactTypeResponse).toBeTruthy();
      expect(response.status).toBe(400);
    });

    it('Should throw when auth key is missing', async () => {
      mockWorkerEnv({
        HIVE_DATA: new Map(),
        KEY_DATA: '',
      });

      const request = new Request('https://fake-worker.com/fake-target-id/sdl', {});

      const response = await handleRequest(request, KeyValidators.AlwaysTrue);
      expect(response instanceof MissingAuthKey).toBeTruthy();
      expect(response.status).toBe(400);
    });

    it('Should throw when key validation function fails', async () => {
      mockWorkerEnv({
        HIVE_DATA: new Map(),
        KEY_DATA: '',
      });

      const request = new Request('https://fake-worker.com/fake-target-id/sdl', {
        headers: {
          'x-hive-cdn-key': 'some-key',
        },
      });

      const response = await handleRequest(request, KeyValidators.AlwaysFalse);
      expect(response instanceof InvalidAuthKey).toBeTruthy();
      expect(response.status).toBe(403);
    });
  });

  describe('Authentication', () => {
    it('Should accept valid auth token', async () => {
      const SECRET = '123456';
      const targetId = 'fake-target-id';
      const map = new Map();
      map.set(`target:${targetId}:schema`, JSON.stringify({ sdl: `type Query { dummy: String }` }));

      mockWorkerEnv({
        HIVE_DATA: map,
        KEY_DATA: SECRET,
      });

      const token = createToken(SECRET, targetId);

      const request = new Request(`https://fake-worker.com/${targetId}/sdl`, {
        headers: {
          'x-hive-cdn-key': token,
        },
      });

      const response = await handleRequest(request, KeyValidators.Bcrypt);
      expect(response.status).toBe(200);
    });

    it('Should throw on missmatch of token target and actual target', async () => {
      const SECRET = '123456';

      mockWorkerEnv({
        HIVE_DATA: new Map(),
        KEY_DATA: SECRET,
      });

      const token = createToken(SECRET, 'fake-target-id');

      const request = new Request(`https://fake-worker.com/some-other-target/sdl`, {
        headers: {
          'x-hive-cdn-key': token,
        },
      });

      const response = await handleRequest(request, KeyValidators.Bcrypt);
      expect(response instanceof InvalidAuthKey).toBeTruthy();
      expect(response.status).toBe(403);
    });

    it('Should throw on invalid token hash', async () => {
      mockWorkerEnv({
        HIVE_DATA: new Map(),
        KEY_DATA: '123456',
      });

      const request = new Request(`https://fake-worker.com/some-target/sdl`, {
        headers: {
          'x-hive-cdn-key': 'i-like-turtles',
        },
      });

      const response = await handleRequest(request, KeyValidators.Bcrypt);
      expect(response instanceof InvalidAuthKey).toBeTruthy();
      expect(response.status).toBe(403);
    });
  });
});
