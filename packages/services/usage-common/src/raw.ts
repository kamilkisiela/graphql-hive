export interface RawReport {
  id: string;
  size: number;
  target: string;
  map: RawOperationMap;
  operations: RawOperation[];
  subscriptionOperations?: RawSubscriptionOperation[];
}

export interface RawOperation {
  operationMapKey: string;
  timestamp: number;
  expiresAt?: number;
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

export type RawSubscriptionOperation = {
  operationMapKey: string;
  timestamp: number;
  expiresAt?: number;
  metadata?: {
    client?: {
      name?: string;
      version?: string;
    };
  };
};

export interface RawOperationMapRecord {
  key: string;
  operation: string;
  operationName?: string | null;
  fields: string[];
}

export interface RawOperationMap {
  [key: string]: RawOperationMapRecord;
}
