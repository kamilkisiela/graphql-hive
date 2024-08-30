import zod from 'zod';
import type { Analytics } from './analytics';
import { AwsClient } from './aws';
import type { Breadcrumb } from './breadcrumbs';

export function buildArtifactStorageKey(
  targetId: string,
  artifactType: string,
  contractName: null | string,
) {
  const parts = ['artifact', targetId];
  if (contractName) {
    parts.push('contracts', contractName);
  }
  parts.push(artifactType);
  return parts.join('/');
}

type SDLArtifactTypes = `sdl${'.graphql' | '.graphqls' | ''}`;

export type ArtifactsType = SDLArtifactTypes | 'metadata' | 'services' | 'supergraph';

const OperationS3BucketKeyModel = zod.tuple([
  zod.string().uuid(),
  zod.string().min(1),
  zod.string().min(1),
  zod.string().min(1),
]);

/**
 * S3 key for stored operation body (used by CDN).
 * Note: we validate to avoid invalid keys / collisions that could be caused by type errors.
 **/
export function buildOperationS3BucketKey(
  ...args: [targetId: string, appName: string, appVersion: string, hash: string]
) {
  return ['app', ...OperationS3BucketKeyModel.parse(args)].join('/');
}

const AppDeploymentIsEnabledKeyModel = zod.tuple([
  zod.string().uuid(),
  zod.string().min(1),
  zod.string().min(1),
]);

/**
 * S3 key for determining whether app deployment is enabled or not.
 * Note: we validate to avoid invalid keys / collisions that could be caused by type errors.
 **/
export function buildAppDeploymentIsEnabledKey(
  ...args: [targetId: string, appName: string, appVersion: string]
) {
  return ['apps-enabled', ...AppDeploymentIsEnabledKeyModel.parse(args)].join('/');
}

/**
 * Read an artifact/app deployment operation from S3.
 */
export class ArtifactStorageReader {
  private breadcrumb: Breadcrumb;

  constructor(
    private s3: {
      client: AwsClient;
      endpoint: string;
      bucketName: string;
    },
    private s3Mirror: {
      client: AwsClient;
      endpoint: string;
      bucketName: string;
    } | null,
    private analytics: Analytics | null,
    breadcrumb: Breadcrumb | null,
    /** Timeout in milliseconds for S3 read calls. */
    private timeout: number = 2_000,
  ) {
    this.breadcrumb = breadcrumb ?? (() => {});
  }

  /**
   * Perform a request to S3, with retries and optional mirror.
   * If the initial request to primary fails, a race between mirror and primary is performed.
   * The first successful response is returned.
   */
  private request(args: {
    /** S3 key in bucket */
    key: string;
    method: 'GET' | 'HEAD' | 'POST';
    headers?: HeadersInit;
    onAttempt: (args: {
      /** whether the attempt is for the mirror */
      isMirror: boolean;
      /** attempt number */
      attempt: number;
      /** attempt duration in ms */
      duration: number;
      /** result */
      result:
        | {
            // HTTP or other unexpected error
            type: 'error';
            error: Error;
          }
        | {
            // HTTP response sent by upstream server
            type: 'success';
            response: Response;
          };
    }) => void;
  }) {
    const primaryObjectEndpoint = [this.s3.endpoint, this.s3.bucketName, args.key].join('/');

    return this.s3.client
      .fetch(primaryObjectEndpoint, {
        method: args.method,
        headers: args.headers,
        aws: {
          signQuery: true,
        },
        timeout: this.timeout,
        retries: this.s3Mirror ? 1 : undefined,
        isResponseOk: response =>
          response.status === 200 || response.status === 304 || response.status === 404,
        onAttempt: args1 => {
          args.onAttempt({
            ...args1,
            isMirror: false,
          });
        },
      })
      .catch(err => {
        this.breadcrumb('Failed to fetch from primary');
        if (!this.s3Mirror) {
          return Promise.reject(err);
        }
        this.breadcrumb('Fetching from primary and mirror now');
        // Use two AbortSignals to avoid a situation
        // where Response.body is consumed,
        // but the request was aborted after being resolved.
        // When a fetch call is resolved successfully,
        // but a shared AbortSignal.cancel() is called for two fetches,
        // it causes an exception (can't read a response from an aborted requests)
        // when Response.body is consumed.
        const primaryController = new AbortController();
        const mirrorController = new AbortController();

        const abortOtherRequest = (ctrl: AbortController, source: string) => {
          return (res: Response) => {
            this.breadcrumb(`Successful fetch from "${source}", aborting other request`);
            // abort other pending request
            const error = new PendingRequestAbortedError();
            ctrl.abort(error);

            return res;
          };
        };

        const mirrorObjectEndpoint = [
          this.s3Mirror.endpoint,
          this.s3Mirror.bucketName,
          args.key,
        ].join('/');

        // Wait for the first successful response
        // or reject if both requests fail
        return Promise.any([
          this.s3.client
            .fetch(primaryObjectEndpoint, {
              method: args.method,
              headers: args.headers,
              aws: {
                signQuery: true,
              },
              timeout: this.timeout,
              signal: primaryController.signal,
              isResponseOk: response =>
                response.status === 200 || response.status === 304 || response.status === 404,
              onAttempt: args1 => {
                args.onAttempt({
                  ...args1,
                  isMirror: false,
                });
              },
            })
            .then(abortOtherRequest(mirrorController, 'primary')),
          this.s3Mirror.client
            .fetch(mirrorObjectEndpoint, {
              method: args.method,
              headers: args.headers,
              aws: {
                signQuery: true,
              },
              timeout: this.timeout,
              signal: mirrorController.signal,
              isResponseOk: response =>
                response.status === 200 || response.status === 304 || response.status === 404,
              onAttempt: args1 => {
                args.onAttempt({
                  ...args1,
                  isMirror: true,
                });
              },
            })
            .then(abortOtherRequest(primaryController, 'mirror')),
        ]);
      });
  }

  /** Read an artifact from S3 */
  async readArtifact(
    targetId: string,
    contractName: string | null,
    artifactType: ArtifactsType,
    etagValue: string | null,
  ) {
    if (artifactType.startsWith('sdl')) {
      artifactType = 'sdl';
    }

    this.breadcrumb(
      `Reading artifact (targetId=${targetId}, artifactType=${artifactType}, contractName=${contractName})`,
    );

    const key = buildArtifactStorageKey(targetId, artifactType, contractName);

    this.breadcrumb(`Reading artifact from S3 key: ${key}`);

    const headers: HeadersInit = {};

    if (etagValue) {
      this.breadcrumb('if-none-match detected');
      headers['if-none-match'] = etagValue;
    }

    const response = await this.request({
      key,
      method: 'GET',
      headers,
      onAttempt: args => {
        this.breadcrumb(
          `Fetch attempt (source=${args.isMirror ? 'mirror' : 'primary'}, attempt=${args.attempt} duration=${args.duration}, result=${args.result.type}, key=${key})`,
        );

        this.analytics?.track(
          {
            type: args.isMirror ? 's3' : 'r2',
            statusCodeOrErrCode:
              args.result.type === 'error'
                ? String(args.result.error.name ?? 'unknown')
                : args.result.response.status,
            action: 'GET artifact',
            duration: args.duration,
          },
          targetId,
        );
      },
    });

    this.breadcrumb(`Response status: ${response.status}`);

    if (response.status === 404) {
      return { type: 'notFound' } as const;
    }

    if (response.status === 304) {
      return {
        type: 'notModified',
      } as const;
    }

    if (response.status === 200) {
      return {
        type: 'response',
        status: response.status,
        headers: response.headers,
        body: await response.text().catch(error => {
          this.breadcrumb('Error reading response body: ' + stringifyError(error));
          return Promise.reject(error);
        }),
      } as const;
    }

    this.breadcrumb(`Failed to read artifact`);

    const body = await response
      .text()
      .catch(error => 'Failed to read response body due to ' + stringifyError(error));
    throw new Error(`GET request failed with status ${response.status}: ${body}`);
  }

  async isAppDeploymentEnabled(targetId: string, appName: string, appVersion: string) {
    const key = buildAppDeploymentIsEnabledKey(targetId, appName, appVersion);

    const response = await this.request({
      key,
      method: 'HEAD',
      onAttempt: args => {
        this.breadcrumb(
          `Fetch attempt (source=${args.isMirror ? 'mirror' : 'primary'}, attempt=${args.attempt} duration=${args.duration}, result=${args.result.type}, key=${key})`,
        );
        this.analytics?.track(
          {
            type: args.isMirror ? 's3' : 'r2',
            statusCodeOrErrCode:
              args.result.type === 'error'
                ? String(args.result.error.name ?? 'unknown')
                : args.result.response.status,
            action: 'HEAD appDeploymentIsEnabled',
            duration: args.duration,
          },
          targetId,
        );
      },
    });

    return response.status === 200;
  }

  async loadAppDeploymentPersistedOperation(
    targetId: string,
    appName: string,
    appVersion: string,
    hash: string,
    etagValue: string | null,
  ) {
    const key = buildOperationS3BucketKey(targetId, appName, appVersion, hash);

    const headers: Record<string, string> = {};
    if (etagValue) {
      headers['if-none-match'] = etagValue;
    }

    const response = await this.request({
      key,
      method: 'GET',
      headers,
      onAttempt: args => {
        this.breadcrumb(
          `Fetch attempt (source=${args.isMirror ? 'mirror' : 'primary'}, attempt=${args.attempt} duration=${args.duration}, result=${args.result.type}, key=${key})`,
        );
        this.analytics?.track(
          {
            type: args.isMirror ? 's3' : 'r2',
            statusCodeOrErrCode:
              args.result.type === 'error'
                ? String(args.result.error.name ?? 'unknown')
                : args.result.response.status,
            action: 'GET persistedOperation',
            duration: args.duration,
          },
          targetId,
        );
      },
    });

    if (etagValue && response.status === 304) {
      return { type: 'notModified' } as const;
    }

    if (response.status === 200) {
      const body = await response.text();
      return {
        type: 'body',
        body,
      } as const;
    }

    if (response.status === 404) {
      return { type: 'notFound' } as const;
    }

    const body = await response.text();
    throw new Error(`HEAD request failed with status ${response.status}: ${body}`);
  }

  async readLegacyAccessKey(targetId: string) {
    const key = ['cdn-legacy-keys', targetId].join('/');
    this.breadcrumb(`Reading from S3 key: ${key}`);
    const response = await this.request({
      key,
      method: 'GET',
      onAttempt: args => {
        this.breadcrumb(
          `Fetch attempt (source=${args.isMirror ? 'mirror' : 'primary'}, attempt=${args.attempt} duration=${args.duration}, result=${args.result.type}, key=${key})`,
        );
        this.analytics?.track(
          {
            type: args.isMirror ? 's3' : 'r2',
            statusCodeOrErrCode:
              args.result.type === 'error'
                ? String(args.result.error.name ?? 'unknown')
                : args.result.response.status,
            action: 'GET cdn-legacy-keys',
            duration: args.duration,
          },
          targetId,
        );
      },
    });

    return response;
  }

  async readAccessKey(targetId: string, keyId: string) {
    const key = ['cdn-keys', targetId, keyId].join('/');
    this.breadcrumb(`Reading from S3 key: ${key}`);

    const response = await this.request({
      key,
      method: 'GET',
      onAttempt: args => {
        this.breadcrumb(
          `Fetch attempt (source=${args.isMirror ? 'mirror' : 'primary'}, attempt=${args.attempt} duration=${args.duration}, result=${args.result.type}, key=${key})`,
        );
        this.analytics?.track(
          {
            type: args.isMirror ? 'r2' : 's3',
            statusCodeOrErrCode:
              args.result.type === 'error'
                ? String(args.result.error.name ?? 'unknown')
                : args.result.response.status,
            action: 'GET cdn-access-token',
            duration: args.duration,
          },
          targetId,
        );
      },
    });

    return response;
  }
}

class PendingRequestAbortedError extends Error {
  constructor() {
    super('Pending request was aborted');
    this.name = 'PendingRequestAbortedError';
  }
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (error instanceof Event || (error != null && typeof error === 'object' && 'type' in error)) {
    return `Event: ${error.type}}`;
  }

  return String(error);
}
