import { getServiceHost } from './utils';

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

export async function legacyCollect(params: {
  operations: CollectedOperation[];
  token: string;
  authorizationHeader?: 'x-api-token' | 'authorization';
}) {
  const usageAddress = await getServiceHost('usage', 8081);
  const res = await fetch(`http://${usageAddress}`, {
    method: 'POST',
    body: JSON.stringify(params.operations),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
    body:
      res.status === 200
        ? ((await res.json()) as {
            operations: {
              accepted: number;
              rejected: number;
            };
          })
        : await res.text(),
  };
}
