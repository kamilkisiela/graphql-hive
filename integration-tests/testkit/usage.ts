import * as utils from 'dockest/test-helper';
import axios from 'axios';
import { isLegacyAuthorizationMode } from './auth';

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

export async function collect(params: { operations: CollectedOperation[]; token: string }) {
  const res = await axios.post(`http://${usageAddress}`, params.operations, {
    headers: {
      'Content-Type': 'application/json',
      ...(isLegacyAuthorizationMode()
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
