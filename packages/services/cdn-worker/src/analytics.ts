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
      type: 'new-key-validation';
      value:
        | {
            type: 'cache-hit';
            isValid: boolean;
          }
        | {
            type: 'cache-write';
            isValid: boolean;
          }
        | {
            type: 's3-key-read-failure';
            status: number | null;
          }
        | {
            type: 's3-key-compare-failure';
          }
        | {
            type: 's3-key-validation-success';
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
        case 'new-key-validation':
          switch (event.value.type) {
            case 'cache-hit':
              return engines.keyValidation.writeDataPoint({
                blobs: ['cache-hit', event.value.isValid ? 'valid' : 'invalid'],
                indexes: [targetId.substr(0, 32)],
              });
            case 'cache-write':
              return engines.keyValidation.writeDataPoint({
                blobs: ['cache-write', event.value.isValid ? 'valid' : 'invalid'],
                indexes: [targetId.substr(0, 32)],
              });
            case 's3-key-validation-success':
              return engines.keyValidation.writeDataPoint({
                blobs: ['s3-key-validation-success', event.value.status],
                indexes: [targetId.substr(0, 32)],
              });
          }
      }
    },
  };
}
