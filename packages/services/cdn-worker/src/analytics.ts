export interface AnalyticsEngine {
  writeDataPoint(input: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export type Analytics = ReturnType<typeof createAnalytics>;

type Event =
  | {
      type: 'artifact';
      value: 'supergraph' | 'sdl' | 'metadata' | 'services' | 'sdl.graphql' | 'sdl.graphqls';
    }
  | {
      type: 'key-validation';
      value:
        | {
            type: 'cache-hit';
            version: 'v1' | 'legacy';
            isValid: boolean;
          }
        | {
            type: 'cache-write';
            version: 'v1' | 'legacy';
            isValid: boolean;
          }
        | {
            type: 's3-key-read-failure';
            version: 'v1' | 'legacy';
            status: number | null;
          }
        | {
            type: 's3-key-compare-failure';
            version: 'v1' | 'legacy';
          }
        | {
            type: 's3-key-validation';
            version: 'v1' | 'legacy';
            status: 'success' | 'failure';
          };
    }
  | {
      type: 'error';
      value: [string, string] | [string];
    }
  | {
      type: 'r2';
      action: 'HEAD artifact' | 'GET cdn-legacy-keys' | 'GET cdn-access-token';
      statusCode: number;
    }
  | {
      type: 'response';
      statusCode: number;
      requestPath: string;
    };

export function createAnalytics(
  engines: {
    usage: AnalyticsEngine;
    error: AnalyticsEngine;
    keyValidation: AnalyticsEngine;
    r2: AnalyticsEngine;
    response: AnalyticsEngine;
  } | null = null,
) {
  return {
    track(event: Event, targetId: string) {
      if (!engines) {
        return;
      }

      switch (event.type) {
        case 'artifact':
          return engines.usage.writeDataPoint({
            blobs: ['v1', event.value, targetId],
            indexes: [targetId.substring(0, 32)],
          });
        case 'error':
          return engines.error.writeDataPoint({
            blobs: event.value,
          });
        case 'r2':
          return engines.r2.writeDataPoint({
            blobs: [event.action, event.statusCode.toString(), targetId],
            indexes: [targetId.substring(0, 32)],
          });
        case 'response':
          return engines.response.writeDataPoint({
            blobs: [event.statusCode.toString(), event.requestPath, targetId],
            indexes: [targetId.substring(0, 32)],
          });
        case 'key-validation':
          switch (event.value.type) {
            case 'cache-hit':
              return engines.keyValidation.writeDataPoint({
                blobs: [
                  'cache-hit',
                  event.value.version,
                  event.value.isValid ? 'valid' : 'invalid',
                ],
                indexes: [targetId.substring(0, 32)],
              });
            case 'cache-write':
              return engines.keyValidation.writeDataPoint({
                blobs: [
                  'cache-write',
                  event.value.version,
                  event.value.isValid ? 'valid' : 'invalid',
                ],
                indexes: [targetId.substring(0, 32)],
              });
            case 's3-key-validation':
              return engines.keyValidation.writeDataPoint({
                blobs: ['s3-key-validation', event.value.version, event.value.status],
                indexes: [targetId.substring(0, 32)],
              });
          }
      }
    },
  };
}
