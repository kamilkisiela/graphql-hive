import * as utils from 'dockest/test-helper';
import axios from 'axios';
import type { ExecutionResult } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';

const registryAddress = utils.getServiceAddress('server', 3001);

export async function execute<R, V>(params: {
  document: TypedDocumentNode<R, V>;
  operationName?: string;
  variables?: V;
  authToken?: string;
  token?: string;
  legacyAuthorizationMode?: boolean;
}) {
  const res = await axios.post<ExecutionResult<R>>(
    `http://${registryAddress}/graphql`,
    {
      query: params.document,
      operationName: params.operationName,
      variables: params.variables,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(params.authToken
          ? {
              Authorization: `Bearer ${params.authToken}`,
            }
          : {}),
        ...(params.token
          ? params.legacyAuthorizationMode
            ? {
                'X-API-Token': params.token,
              }
            : {
                Authorization: `Bearer ${params.token}`,
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
