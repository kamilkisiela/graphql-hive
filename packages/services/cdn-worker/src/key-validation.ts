import bcrypt from 'bcryptjs';
import { Request, Response } from '@whatwg-node/fetch';
import { type AwsClient } from './aws';

export type KeyValidator = (targetId: string, headerKey: string) => Promise<boolean>;

type CreateKeyValidatorDeps = {
  keyData: string;
  s3: {
    endpoint: string;
    bucketName: string;
    client: AwsClient;
  };
  getCache: () => Promise<Cache | null> | Cache | null;
  waitUntil: null | ((promise: void | Promise<void>) => void);
};

export const createIsKeyValid =
  (deps: CreateKeyValidatorDeps) =>
  async (targetId: string, accessHeaderValue: string): Promise<boolean> => {
    let withCache = (isValid: boolean) => Promise.resolve(isValid);

    {
      const requestCache = await deps.getCache();
      if (requestCache) {
        const cacheKey = new Request(
          ['http://key-cache.graphql-hive.com/', 'legacy', targetId].join('/'),
          {
            method: 'GET',
          },
        );

        const response = await requestCache.match(cacheKey);
        if (response) {
          return (await response.text()) === '1';
        }

        withCache = async (isValid: boolean) => {
          const promise = requestCache.put(
            cacheKey,
            new Response(isValid ? '1' : '0', {
              status: 200,
              headers: {
                'Cache-Control': `s-maxage=${60 * 5}`,
              },
            }),
          );

          if (deps.waitUntil) {
            deps.waitUntil(promise);
          } else {
            await promise;
          }

          return isValid;
        };
      }
    }

    const key = await deps.s3.client.fetch(
      [deps.s3.endpoint, deps.s3.bucketName, 'cdn-legacy-keys', targetId].join('/'),
      {
        method: 'GET',
      },
    );

    if (key.status !== 200) {
      return withCache(false);
    }

    const isValid = await bcrypt.compare(accessHeaderValue, await key.text());
    return withCache(isValid);
  };
