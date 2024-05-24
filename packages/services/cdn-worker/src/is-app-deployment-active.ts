import { type ArtifactStorageReader } from './artifact-storage-reader';

type GetCache = () => Promise<Cache | null>;
type WaitUntil = (promise: Promise<void>) => void;

export type IsAppDeploymentActive = (
  targetId: string,
  appName: string,
  appVersion: string,
) => Promise<boolean>;

/** check whether an app deployment is active (optionally using a cache to avoid accessing S3) */
export function createIsAppDeploymentActive(deps: {
  artifactStorageReader: ArtifactStorageReader;
  waitUntil: null | WaitUntil;
  getCache: null | GetCache;
}): IsAppDeploymentActive {
  return async function isAppDeploymentActive(
    targetId: string,
    appName: string,
    appVersion: string,
  ): Promise<boolean> {
    const cache = await (deps.getCache ? deps.getCache() : null);
    const cacheKey = new Request(
      [
        'http://key-cache.graphql-hive.com',
        'v1',
        targetId,
        'apps-enabled',
        appName,
        appVersion,
      ].join('/'),
      {
        method: 'GET',
      },
    );

    if (cache) {
      const response = await cache.match(cacheKey);

      if (response) {
        const responseValue = await response.text();
        return responseValue === '1';
      }
    }

    const isEnabled = await deps.artifactStorageReader.isAppDeploymentEnabled(
      targetId,
      appName,
      appVersion,
    );

    if (cache) {
      const promise = cache.put(
        cacheKey,
        new Response(isEnabled ? '1' : '0', {
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
    }

    return isEnabled;
  };
}
