export interface AnalyticsEngine {
  writeDataPoint(input: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export type Analytics = ReturnType<typeof createAnalytics>;

type Event =
  | {
      type: 'artifact';
      version: 'v0' | 'v1';
      value:
        | 'schema'
        | 'supergraph'
        | 'sdl'
        | 'metadata'
        | 'introspection'
        | 'services'
        | 'sdl.graphql'
        | 'sdl.graphqls';
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
    };

export function createAnalytics(
  engines: {
    usage: AnalyticsEngine;
    error: AnalyticsEngine;
    keyValidation: AnalyticsEngine;
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
            blobs: [event.version, event.value, targetId],
            indexes: [targetId.substr(0, 32)],
          });
        case 'error':
          return engines.error.writeDataPoint({
            blobs: event.value,
          });
        case 'key-validation':
          // eslint-disable-next-line sonarjs/no-nested-switch -- TODO: refactor
          switch (event.value.type) {
            case 'cache-hit':
              return engines.keyValidation.writeDataPoint({
                blobs: [
                  'cache-hit',
                  event.value.version,
                  event.value.isValid ? 'valid' : 'invalid',
                ],
                indexes: [targetId.substr(0, 32)],
              });
            case 'cache-write':
              return engines.keyValidation.writeDataPoint({
                blobs: [
                  'cache-write',
                  event.value.version,
                  event.value.isValid ? 'valid' : 'invalid',
                ],
                indexes: [targetId.substr(0, 32)],
              });
            case 's3-key-validation':
              return engines.keyValidation.writeDataPoint({
                blobs: ['s3-key-validation', event.value.version, event.value.status],
                indexes: [targetId.substr(0, 32)],
              });
          }
      }
    },
  };
}
