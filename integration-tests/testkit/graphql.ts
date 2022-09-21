import * as utils from 'dockest/test-helper';
import axios from 'axios';
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
  const res = await axios.post<ExecutionResult<TResult>>(
    `http://${registryAddress}/graphql`,
    {
      query: print(params.document),
      operationName: params.operationName,
      variables: params.variables,
    },
    {
      headers: {
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
      responseType: 'json',
    }
  );

  return {
    body: res.data,
    status: res.status,
  };
}
