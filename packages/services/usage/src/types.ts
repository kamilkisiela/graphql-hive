export interface LegacyIncomingOperation {
  timestamp?: number;
  operation: string;
  operationName?: string | null;
  fields: string[];
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
    errors?: Array<{
      message: string;
      path?: string;
    }>;
  };
  metadata?: {
    client?: {
      name?: string;
      version?: string;
    };
  };
}

export interface OperationMapRecord {
  operation: string;
  operationName?: string | null;
  fields: string[];
}

export interface OperationMap {
  [key: string]: OperationMapRecord;
}

export interface IncomingReport {
  map: OperationMap;
  operations?: IncomingOperation[];
  subscriptionOperations?: IncomingSubscriptionOperation[];
}

export type IncomingLegacyReport = LegacyIncomingOperation[];

export interface IncomingOperation {
  operationMapKey: string;
  timestamp?: number;
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

export interface IncomingSubscriptionOperation {
  operationMapKey: string;
  timestamp?: number;
  metadata?: {
    client?: {
      name?: string;
      version?: string;
    };
  };
}
