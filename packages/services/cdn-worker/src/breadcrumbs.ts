export type Breadcrumb = (message: string) => void;

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
      type: 'app-deployment-operation';
      version: 'v1';
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
      type: 'r2' | 's3';
      action:
        | 'GET artifact'
        | 'GET cdn-legacy-keys'
        | 'GET cdn-access-token'
        | 'GET persistedOperation'
        | 'HEAD appDeploymentIsEnabled';
      // Either 3 digit status code or error code e.g. timeout, http error etc.
      statusCodeOrErrCode: number | string;
      /** duration in milliseconds */
      duration: number;
    }
  | {
      type: 'response';
      statusCode: number;
      requestPath: string;
    };

export function createBreadcrumb() {
  return (message: string) => {
    console.debug(message);
  };
}
