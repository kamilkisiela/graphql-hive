import * as utils from 'dockest/test-helper';
import { fetch } from '@whatwg-node/fetch';

const usageAddress = utils.getServiceAddress('usage', 3006);

export interface CollectedOperation {
  timestamp?: number;
  operation: string;
  operationName?: string;
  fields: string[];
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
  };
  metadata?: {
    client?: {
      name?: string;
      version?: string;
    };
  };
}

export async function collect(params: {
  operations: CollectedOperation[];
  token: string;
  authorizationHeader?: 'x-api-token' | 'authorization';
}) {
  const res = await fetch(`http://${usageAddress}`, {
    method: 'POST',
    body: JSON.stringify(params.operations),
    headers: {
      'Content-Type': 'application/json',
      ...(params.authorizationHeader === 'x-api-token'
        ? {
            'X-API-Token': params.token,
          }
        : {
            Authorization: `Bearer ${params.token}`,
          }),
    },
  });

  return {
    status: res.status,
  };
}
