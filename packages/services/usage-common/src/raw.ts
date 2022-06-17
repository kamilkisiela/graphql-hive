export interface RawReport {
  id: string;
  target: string;
  size: number;
  map: RawOperationMap;
  operations: RawOperation[];
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

export interface RawOperationMapRecord {
  key: string;
  operation: string;
  operationName?: string | null;
  fields: string[];
}

export interface RawOperationMap {
  [key: string]: RawOperationMapRecord;
}
