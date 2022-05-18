import type { OperationTypeNode } from 'graphql';
import type { RawOperation } from './raw';

export type ProcessedReport = ProcessedOperation[];

export interface ProcessedOperation {
  target: string;
  document: string;
  operationName?: string | null;
  operationHash: string;
  operationType: OperationTypeNode;
  fields: string[];
  timestamp: number;
  expiresAt: number;
  execution: RawOperation['execution'];
  metadata?: RawOperation['metadata'];
}

export interface ProcessedRegistryRecord {
  target: string;
  hash: string;
  name?: string | null;
  body: string;
  operation: string;
  inserted_at: number;
}
