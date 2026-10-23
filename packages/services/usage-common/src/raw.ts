export interface RawReport {
  id: string;
  size: number;
  target: string;
  organization: string;
  map: RawOperationMap;
  operations: RawOperation[];
  subscriptionOperations?: RawSubscriptionOperation[];
  appDeploymentUsageTimestamps?: RawAppDeploymentUsageTimestampMap;
  errors?: RawOperationErrors[];
}

export interface RawAppDeploymentUsageTimestampMap {
  /** key is `${appName}/${appVersion}` */
  [key: string]: number;
}

export interface ClientMetadata {
  name?: string;
  version?: string;
}

export interface GraphMetadata {
  graphId?: string;
  graphVersionId?: string;
}

export interface RawOperation {
  operationMapKey: string;
  timestamp: number;
  expiresAt?: number;
  execution: {
    ok: boolean;
    duration: number;
    errorsTotal: number;
    /** Count of how many times a coordinate was resolved by this operation */
    coordinateTotals?: { [coordinate: string]: number };
  };
  metadata?: {
    client?: ClientMetadata;
    graph?: GraphMetadata;
  };
}

export interface RawOperationErrors {
  operationMapKey: string;
  timestamp: number;
  expiresAt?: number;
  errors: { code?: string; coordinate: string }[];
}

export type RawSubscriptionOperation = {
  operationMapKey: string;
  timestamp: number;
  expiresAt?: number;
  metadata?: {
    client?: ClientMetadata;
    graph?: GraphMetadata;
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
