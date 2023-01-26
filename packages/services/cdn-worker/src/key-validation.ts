import bcrypt from 'bcryptjs';
import { crypto } from '@whatwg-node/fetch';
import { Analytics } from './analytics';
import { AwsClient } from './aws';

const encoder = new TextEncoder();

export function byteStringToUint8Array(byteString: string) {
  const ui = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; ++i) {
    ui[i] = byteString.charCodeAt(i);
  }

  return ui;
}

export type KeyValidator = (targetId: string, headerKey: string) => Promise<boolean>;

type WaitUntil = (promise: Promise<void>) => void;

type S3Config = {
  client: AwsClient;
  bucketName: string;
  endpoint: string;
};

type CreateKeyValidatorDeps = {
  keyData: string;
  waitUntil?: WaitUntil;
  s3?: S3Config;
  getCache?: () => Promise<Cache | null>;
  analytics?: Analytics;
};

const atobMaybe = (str: string): string | null => {
  try {
    return atob(str);
  } catch {
    return null;
  }
};

export const createIsKeyValid =
  (deps: CreateKeyValidatorDeps): KeyValidator =>
  async (targetId: string, accessHeaderValue: string): Promise<boolean> => {
    const headerBinary = atobMaybe(accessHeaderValue);
    if (headerBinary === null) {
      return false;
    }
    const headerData = byteStringToUint8Array(headerBinary);
    const secretKeyData = encoder.encode(deps.keyData);
    const secretKey = await crypto.subtle.importKey(
      'raw',
      secretKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const verifyPromise = crypto.subtle.verify(
      'HMAC',
      secretKey,
      headerData,
      encoder.encode(targetId),
    );

    // check the new method and report whether it fails or not
    if (deps.waitUntil && deps.s3 && deps.getCache && deps.analytics) {
      const { s3, waitUntil, getCache, analytics } = deps;
      deps.waitUntil(
        verifyPromise.then(oldMethodSucceeded =>
          oldMethodSucceeded
            ? newIsKeyValidCheck({
                targetId,
                accessToken: accessHeaderValue,
                s3,
                oldMethodSucceeded,
                waitUntil,
                getCache,
                analytics,
              }).then(() => undefined)
            : Promise.resolve(),
        ),
      );
    }

    return await verifyPromise;
  };

const newIsKeyValidCheck = async (args: {
  targetId: string;
  accessToken: string;
  s3: S3Config;
  oldMethodSucceeded: boolean;
  getCache: () => Promise<Cache | null>;
  waitUntil: WaitUntil;
  analytics: Analytics;
}): Promise<boolean> => {
  let withCache = (isValid: boolean) => Promise.resolve(isValid);

  {
    const requestCache = await args.getCache();

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

        args.analytics.track(
          {
            type: 'new-key-validation',
            value: {
              type: 'cache-hit',
              isValid,
            },
          },
          args.targetId,
        );

        return isValid;
      }

      withCache = async (isValid: boolean) => {
        args.analytics.track(
          {
            type: 'new-key-validation',
            value: {
              type: 'cache-write',
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

  if (key.status !== 200) {
    return withCache(false);
  }

  const isValid = await bcrypt.compare(args.accessToken, await key.text());

  args.analytics.track(
    {
      type: 'new-key-validation',
      value: {
        type: 's3-key-validation-success',
        status: isValid ? 'success' : 'failure',
      },
    },
    args.targetId,
  );

  return withCache(isValid);
};
