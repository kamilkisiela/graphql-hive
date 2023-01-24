import bcrypt from 'bcryptjs';
import { Request, Response } from '@whatwg-node/fetch';
import { type AwsClient } from './aws';

export type KeyValidator = (targetId: string, headerKey: string) => Promise<boolean>;

type CreateKeyValidatorDeps = {
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
        console.log(`attempt reading from cache. (targetId=${targetId})`);

        const cacheKey = new Request(
          [
            'https://key-cache.graphql-hive.com',
            'legacy',
            targetId,
            encodeURIComponent(accessHeaderValue),
          ].join('/'),
          {
            method: 'GET',
          },
        );

        const response = await requestCache.match(cacheKey);

        if (response) {
          console.log(`cache entry found. (targetId=${targetId})`);

          const isValid = (await response.text()) === '1';

          return isValid;
        }

        console.log(`cache entry not found. (targetId=${targetId})`);

        withCache = async (isValid: boolean) => {
          console.log(`write to cache. (targetId=${targetId}, isValid=${isValid})`);

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

    console.log(`fetch key (targetId=${targetId})`);

    const key = await deps.s3.client.fetch(
      [deps.s3.endpoint, deps.s3.bucketName, 'cdn-legacy-keys', targetId].join('/'),
      {
        method: 'GET',
      },
    );

    if (key.status !== 200) {
      console.log(`key not found (targetId=${targetId})`);
      return withCache(false);
    }

    console.log(`key found (targetId=${targetId})`);

    const isValid = await bcrypt.compare(accessHeaderValue, await key.text());

    console.log(`validating key against access key (targetId=${targetId}, isValid=${isValid})`);

    return withCache(isValid);
  };
