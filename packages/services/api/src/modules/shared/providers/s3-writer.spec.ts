import { describe, expect, it } from 'vitest';
import type { AwsClient } from '../../cdn/providers/aws';
import { S3Config, type S3Destination } from './s3-config';
import { S3Writer } from './s3-writer';

type FetchResponse = Awaited<ReturnType<AwsClient['fetch']>>;

/** A destination whose PUT stays pending until the test resolves it. */
function createDestination(endpoint: string) {
  const pending: Array<(response: FetchResponse) => void> = [];
  const destination: S3Destination = {
    endpoint,
    bucket: 'bucket',
    client: {
      fetch: (url: string) =>
        new Promise<FetchResponse>(resolve => {
          pending.push(response => resolve({ ...response, url } as FetchResponse));
        }),
    } as unknown as AwsClient,
  };

  return {
    destination,
    get putCount() {
      return pending.length;
    },
    resolveAll(statusCode = 200) {
      for (const resolve of pending.splice(0)) {
        resolve({ statusCode, headers: {} } as FetchResponse);
      }
    },
  };
}

function createWriter() {
  const primary = createDestination('https://primary.example.com');
  const mirror = createDestination('https://mirror.example.com');
  const writer = new S3Writer(
    new S3Config([primary.destination, mirror.destination]),
    () => {},
    () => {},
  );
  return { writer, primary, mirror };
}

describe('S3Writer', () => {
  it('writeConcurrently starts the mirror PUT without waiting for the primary PUT', async () => {
    const { writer, primary, mirror } = createWriter();

    const responses = writer.writeConcurrently('key', 'persisted_document', { body: 'doc' });
    await Promise.resolve();

    expect(primary.putCount).toBe(1);
    expect(mirror.putCount).toBe(1);

    primary.resolveAll(200);
    mirror.resolveAll(200);

    await expect(responses).resolves.toMatchObject([
      { statusCode: 200, url: 'https://primary.example.com/bucket/key' },
      { statusCode: 200, url: 'https://mirror.example.com/bucket/key' },
    ]);
  });

  it('write waits for the primary PUT before starting the mirror PUT', async () => {
    const { writer, primary, mirror } = createWriter();

    const responses = writer.write('key', 'artifact_latest', { body: 'sdl' });
    await Promise.resolve();

    expect(primary.putCount).toBe(1);
    expect(mirror.putCount).toBe(0);

    primary.resolveAll(200);
    await Promise.resolve();
    await Promise.resolve();

    expect(mirror.putCount).toBe(1);
    mirror.resolveAll(200);

    await expect(responses).resolves.toMatchObject([
      { statusCode: 200, url: 'https://primary.example.com/bucket/key' },
      { statusCode: 200, url: 'https://mirror.example.com/bucket/key' },
    ]);
  });
});
