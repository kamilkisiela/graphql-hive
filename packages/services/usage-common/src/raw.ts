export interface RawReport {
  id: string;
  size: number;
  target: string;
  organization: string;
  map: RawOperationMap;
  operations: RawOperation[];
  subscriptionOperations?: RawSubscriptionOperation[];
  appDeploymentUsageTimestamps?: RawAppDeploymentUsageTimestampMap;
}

export interface RawAppDeploymentUsageTimestampMap {
  /** key is `${appName}/${appVersion}` */
  [key: string]: number;
}

export interface ClientMetadata {
  name?: string;
  version?: string;
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
    client?: ClientMetadata;
  };
}

export type RawSubscriptionOperation = {
  operationMapKey: string;
  timestamp: number;
  expiresAt?: number;
  metadata?: {
    client?: ClientMetadata;
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
