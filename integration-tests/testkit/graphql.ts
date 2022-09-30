import * as utils from 'dockest/test-helper';
import { fetch } from '@whatwg-node/fetch';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ExecutionResult, print } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

const registryAddress = utils.getServiceAddress('server', 3001);

export async function execute<TResult, TVariables>(
  params: {
    document: TypedDocumentNode<TResult, TVariables>;
    operationName?: string;
    authToken?: string;
    token?: string;
    legacyAuthorizationMode?: boolean;
  } & (TVariables extends Record<string, never> ? { variables?: never } : { variables: TVariables })
) {
  const response = await fetch(`http://${registryAddress}/graphql`, {
    method: 'POST',
    body: JSON.stringify({
      query: print(params.document),
      operationName: params.operationName,
      variables: params.variables,
    }),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(params.authToken
        ? {
            authorization: `Bearer ${params.authToken}`,
          }
        : {}),
      ...(params.token
        ? params.legacyAuthorizationMode
          ? {
              'x-api-token': params.token,
            }
          : {
              authorization: `Bearer ${params.token}`,
            }
        : {}),
    },
  });
  return {
    body: (await response.json()) as ExecutionResult<TResult>,
    status: response.status,
  };
}
