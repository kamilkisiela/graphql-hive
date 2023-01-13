import { Response } from '@whatwg-node/fetch';
import bcrypt from 'bcryptjs';
import { AwsClient } from 'packages/services/api/src/shared/aws';

export type KeyValidator = (targetId: string, headerKey: string) => Promise<boolean>;

type CreateKeyValidatorDeps = {
  keyData: string;
  s3: {
    endpoint: string;
    bucketName: string;
    client: AwsClient;
  };
  cache: Cache | null;
};

export const createIsKeyValid =
  (deps: CreateKeyValidatorDeps): KeyValidator =>
  async (targetId: string, accessHeaderValue: string): Promise<boolean> => {
    const cacheKey = 'http://key-cache.graphql-hive.com/' + targetId;

    let response = await deps.cache?.match(cacheKey);

    if (response) {
      return (await response.text()) === '1';
    }

    const key = await deps.s3.client.fetch(
      [deps.s3.endpoint, deps.s3.bucketName, 'cdn-legacy-keys', targetId].join('/'),
      {
        method: 'GET',
      },
    );

    if (key.status !== 200) {
      return false;
    }

    const isValid = await bcrypt.compare(accessHeaderValue, await key.text());

    await deps.cache?.put(
      cacheKey,
      new Response(isValid ? '1' : '0', {
        status: 200,
        headers: {
          'Cache-Control': `s-maxage=${60 * 5}`,
        },
      }),
    );

    return isValid;
  };
