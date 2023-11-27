import bcrypt from 'bcryptjs';
import { Request, Response } from '@whatwg-node/fetch';
import { Analytics } from './analytics';
import { type AwsClient } from './aws';
import { decodeCdnAccessTokenSafe, isCDNAccessToken } from './cdn-token';

export type KeyValidator = (targetId: string, headerKey: string) => Promise<boolean>;

type WaitUntil = (promise: Promise<void>) => void;

type S3Config = {
  client: AwsClient;
  bucketName: string;
  endpoint: string;
};

type GetCache = () => Promise<Cache | null>;

type CreateKeyValidatorDeps = {
  waitUntil: null | WaitUntil;
  s3: S3Config;
  getCache: null | GetCache;
  analytics: null | Analytics;
};

export const createIsKeyValid =
  (deps: CreateKeyValidatorDeps): KeyValidator =>
  async (targetId: string, accessHeaderValue: string): Promise<boolean> => {
    if (isCDNAccessToken(accessHeaderValue)) {
      return handleCDNAccessToken(deps, targetId, accessHeaderValue);
    }

    return handleLegacyCDNAccessToken({
      ...deps,
      targetId,
      accessToken: accessHeaderValue,
    });
  };

const handleLegacyCDNAccessToken = async (args: {
  targetId: string;
  accessToken: string;
  s3: S3Config;
  getCache: null | GetCache;
  waitUntil: null | WaitUntil;
  analytics: null | Analytics;
}): Promise<boolean> => {
  let withCache = (isValid: boolean) => Promise.resolve(isValid);

  {
    const requestCache = await args.getCache?.();

    if (requestCache) {
      const cacheKey = new Request(
        [
          'https://key-cache.graphql-hive.com',
          'legacy',
          args.targetId,
          encodeURIComponent(args.accessToken),
        ].join('/'),
        {
          method: 'GET',
        },
      );

      const response = await requestCache.match(cacheKey);

      if (response) {
        const responseValue = await response.text();

        const isValid = responseValue === '1';

        args.analytics?.track(
          {
            type: 'key-validation',
            value: {
              type: 'cache-hit',
              version: 'legacy',
              isValid,
            },
          },
          args.targetId,
        );

        return isValid;
      }

      withCache = async (isValid: boolean) => {
        args.analytics?.track(
          {
            type: 'key-validation',
            value: {
              type: 'cache-write',
              version: 'legacy',
              isValid,
            },
          },
          args.targetId,
        );

        const promise = requestCache.put(
          cacheKey,
          new Response(isValid ? '1' : '0', {
            status: 200,
            headers: {
              'Cache-Control': `s-maxage=${60 * 5}`,
            },
          }),
        );

        if (args.waitUntil) {
          args.waitUntil(promise);
        } else {
          await promise;
        }

        return isValid;
      };
    }
  }

  const key = await args.s3.client.fetch(
    [args.s3.endpoint, args.s3.bucketName, 'cdn-legacy-keys', args.targetId].join('/'),
    {
      method: 'GET',
    },
  );

  args.analytics?.track(
    {
      type: 'r2',
      statusCode: key.status,
      action: 'GET cdn-legacy-keys',
    },
    args.targetId,
  );

  if (key.status !== 200) {
    return withCache(false);
  }

  const isValid = await bcrypt.compare(args.accessToken, await key.text());

  args.analytics?.track(
    {
      type: 'key-validation',
      value: {
        type: 's3-key-validation',
        version: 'legacy',
        status: isValid ? 'success' : 'failure',
      },
    },
    args.targetId,
  );

  return withCache(isValid);
};

async function handleCDNAccessToken(
  deps: CreateKeyValidatorDeps,
  targetId: string,
  accessToken: string,
) {
  let withCache = (isValid: boolean) => Promise.resolve(isValid);

  {
    const requestCache = await deps.getCache?.();

    if (requestCache) {
      const cacheKey = new Request(
        ['http://key-cache.graphql-hive.com', 'v1', targetId, encodeURIComponent(accessToken)].join(
          '/',
        ),
        {
          method: 'GET',
        },
      );

      const response = await requestCache.match(cacheKey);

      if (response) {
        const responseValue = await response.text();

        const isValid = responseValue === '1';

        deps.analytics?.track(
          {
            type: 'key-validation',
            value: {
              type: 'cache-hit',
              version: 'v1',
              isValid,
            },
          },
          targetId,
        );

        return isValid;
      }

      withCache = async (isValid: boolean) => {
        deps.analytics?.track(
          {
            type: 'key-validation',
            value: {
              type: 'cache-write',
              version: 'v1',
              isValid,
            },
          },
          targetId,
        );

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

  const decodeResult = decodeCdnAccessTokenSafe(accessToken);

  if (decodeResult.type === 'failure') {
    return withCache(false);
  }

  const s3KeyParts = ['cdn-keys', targetId, decodeResult.token.keyId];

  const key = await deps.s3.client.fetch(
    [deps.s3.endpoint, deps.s3.bucketName, ...s3KeyParts].join('/'),
    {
      method: 'GET',
      aws: {
        // This boolean makes Google Cloud Storage & AWS happy.
        signQuery: true,
      },
    },
  );

  deps.analytics?.track(
    {
      type: 'r2',
      statusCode: key.status,
      action: 'GET cdn-access-token',
    },
    targetId,
  );

  if (key.status !== 200) {
    return withCache(false);
  }

  const isValid = await bcrypt.compare(decodeResult.token.privateKey, await key.text());

  deps.analytics?.track(
    {
      type: 'key-validation',
      value: {
        type: 's3-key-validation',
        version: 'v1',
        status: isValid ? 'success' : 'failure',
      },
    },
    targetId,
  );

  return withCache(isValid);
}
