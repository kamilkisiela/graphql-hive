import { print, type ExecutionResult, type GraphQLError } from 'graphql';
import { http } from '@graphql-hive/core';
import { LegacyLogger } from '@graphql-hive/core/typings/client/types';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  AccessDeniedError,
  APIError,
  HTTPError,
  IntrospectionError,
  InvalidRegistryTokenError,
  isAggregateError,
  isTimeoutError,
  MissingArgumentsError,
  NetworkError,
  RequestTimeoutError,
  UnsupportedServerError,
} from './errors';

export function graphqlRequest(config: {
  endpoint: string;
  additionalHeaders?: Record<string, string>;
  version?: string;
  logger?: LegacyLogger;
  /** Map errors returned by the Hive registry API, and timeouts, to dedicated CLI errors. */
  isHiveRegistry?: boolean;
}) {
  const requestHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': `hive-cli/${config.version}`,
    ...config.additionalHeaders,
  };

  return {
    request: async <TResult, TVariables>(
      args: {
        operation: TypedDocumentNode<TResult, TVariables>;
        /** timeout in milliseconds */
        timeout?: number;
        /** Retry configuration. Set to `false` for having no retries. */
        retry?: Parameters<typeof http.post>[2]['retry'];
      } & (TVariables extends Record<string, never>
        ? {
            variables?: never;
          }
        : {
            variables: TVariables;
          }),
    ): Promise<TResult> => {
      let response: Response;
      try {
        response = await http.post(
          config.endpoint,
          JSON.stringify({
            query: typeof args.operation === 'string' ? args.operation : print(args.operation),
            variables: args.variables,
          }),
          {
            logger: config.logger,
            headers: requestHeaders,
            timeout: args.timeout,
            retry: args.retry,
          },
        );
      } catch (e: any) {
        if (typeof e?.status === 'number') {
          throw new HTTPError(config.endpoint, e.status, e.statusText || e.message, e.requestId);
        }
        if (config.isHiveRegistry && isTimeoutError(e)) {
          throw new RequestTimeoutError(config.endpoint, e?.cause ?? e);
        }
        const sourceError = e?.cause ?? e;
        if (isAggregateError(sourceError)) {
          throw new NetworkError(sourceError.errors[0]?.message);
        } else {
          throw new NetworkError(sourceError);
        }
      }

      if (!response.ok) {
        throw new HTTPError(
          config.endpoint,
          response.status,
          response.statusText ?? 'Invalid status code for HTTP call',
          response.headers.get('x-request-id') ?? undefined,
        );
      }

      let jsonData;
      try {
        jsonData = (await response.json()) as ExecutionResult<TResult>;
      } catch (err) {
        config.logger?.debug?.(String(err));
        const contentType = response?.headers?.get('content-type');
        throw new APIError(
          `Response from graphql was not valid JSON.${contentType ? ` Received "content-type": "${contentType}".` : ''}`,
          cleanRequestId(response?.headers?.get('x-request-id')),
        );
      }

      if (jsonData.errors && jsonData.errors.length > 0) {
        config.logger?.debug?.(jsonData.errors.map(String).join('\n'));

        const requestId = cleanRequestId(response?.headers?.get('x-request-id'));

        if (config.isHiveRegistry) {
          throwRegistryError(config.endpoint, jsonData.errors, requestId);
        } else if (isIntrospectionDisabledError(jsonData.errors[0])) {
          throw new IntrospectionError(config.endpoint);
        }

        throw new APIError(
          jsonData.errors.map(e => e.message).join('\n'),
          requestId,
          jsonData.errors,
        );
      }

      return jsonData.data!;
    },
  };
}

const missingPermissionPattern = /Missing permission for performing '([^']+)'/;

/** GraphQL validation errors caused by the server not knowing a field, argument, input field or type the CLI sends. */
const unsupportedByServerPatterns = [
  /^Cannot query field "[^"]+" on type "[^"]+"\./,
  /^Unknown argument "[^"]+" on field "[^"]+"\./,
  /^Unknown type "[^"]+"\./,
  /^Variable "\$[^"]+" got invalid value [\s\S]*; Field "[^"]+" is not defined by type "[^"]+"\./,
];
/** Reported alongside "Unknown type" when a variable of that type exists. */
const unusedVariablePattern = /^Variable "\$[^"]+" is never used/;

function isUnsupportedByServer(errors: ReadonlyArray<GraphQLError>): boolean {
  return (
    errors.some(error =>
      unsupportedByServerPatterns.some(pattern => pattern.test(error.message)),
    ) &&
    errors.every(
      error =>
        unusedVariablePattern.test(error.message) ||
        unsupportedByServerPatterns.some(pattern => pattern.test(error.message)),
    )
  );
}

/**
 * Hive registry API errors that have a dedicated CLI error.
 * The registry reports authentication failures either as "Invalid token provided" (access tokens)
 * or with the UNAUTHENTICATED / NEEDS_REFRESH codes (session tokens),
 * and authorization failures with the UNAUTHORISED code.
 */
function throwRegistryError(
  endpoint: string,
  errors: ReadonlyArray<GraphQLError>,
  requestId: string | undefined,
): void {
  if (errors.some(error => error.extensions?.code === 'ERR_MISSING_TARGET')) {
    throw new MissingArgumentsError([
      'target',
      'The target on which the action is performed.' +
        ' This can either be a slug following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g "the-guild/graphql-hive/staging")' +
        ' or an UUID (e.g. "a0f4c605-6541-4350-8cfe-b31f21a4bf80").',
    ]);
  }

  if (
    errors.some(
      error =>
        error.message === 'Invalid token provided' ||
        error.extensions?.code === 'UNAUTHENTICATED' ||
        error.extensions?.code === 'NEEDS_REFRESH',
    )
  ) {
    throw new InvalidRegistryTokenError();
  }

  const accessError = errors.find(error => error.extensions?.code === 'UNAUTHORISED');
  if (accessError) {
    throw new AccessDeniedError(
      accessError.message,
      accessError.message.match(missingPermissionPattern)?.[1] ?? null,
      requestId,
    );
  }

  if (isUnsupportedByServer(errors)) {
    throw new UnsupportedServerError(endpoint, errors);
  }
}

export function cleanRequestId(requestId?: string | null) {
  return requestId ? requestId.split(',')[0].trim() : undefined;
}

export function isIntrospectionDisabledError(error: GraphQLError): boolean {
  // Default implementation - this is the string used by graphql-js and thus the majority of all other implementations
  // as they use graphql-js as a reference.
  // https://github.com/graphql/graphql-js/blob/8eb6383ae7447514343457abb2063c40e5dc81bc/src/validation/rules/custom/NoSchemaIntrospectionCustomRule.ts#L30
  if (error.message?.includes('GraphQL introspection has been disabled')) {
    return true;
  }
  // Apollo Server
  // https://github.com/apollographql/apollo-server/blob/19d0ffca703f85f0184532393aa3fff687f30bca/packages/server/src/validationRules/NoIntrospection.ts#L20
  if (error.extensions?.['validationErrorCode'] === 'INTROSPECTION_DISABLED') {
    return true;
  }
  // https://github.com/apollographql/apollo-server/blob/19d0ffca703f85f0184532393aa3fff687f30bca/packages/server/src/validationRules/NoIntrospection.ts#L15
  if (error.message?.includes('GraphQL introspection is not allowed')) {
    return true;
  }
  return false;
}
