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
      type: 'error';
      value: [string, string] | [string];
    };

export function createAnalytics(
  engines: {
    usage: AnalyticsEngine;
    error: AnalyticsEngine;
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
      }
    },
  };
}
