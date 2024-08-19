import LRU from 'tiny-lru';
import {
  castValue,
  ProcessedAppDeploymentUsageRecord,
  type ProcessedOperation,
  type ProcessedRegistryRecord,
  type ProcessedSubscriptionOperation,
} from '@hive/usage-common';
import { cache } from './helpers';

const delimiter = '\n';
const formatter = Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatDate(date: number): string {
  return formatter
    .format(date)
    .replace(',', '')
    .replace(/(\d+)\/(\d+)\/(\d+)/, (_, d, m, y) => `${y}-${m}-${d}`);
}

function dateCacheKey(date: number): string {
  return String(Math.floor(date / 1000) * 1000);
}

const cachedFormatDate = cache(formatDate, dateCacheKey, LRU(50_000));

export const operationsOrder = [
  'organization',
  'target',
  'timestamp',
  'expires_at',
  'hash',
  'ok',
  'errors',
  'duration',
  'client_name',
  'client_version',
] as const;

export const subscriptionOperationsOrder = [
  'organization',
  'target',
  'timestamp',
  'expires_at',
  'hash',
  'client_name',
  'client_version',
] as const;

export const registryOrder = [
  'total',
  'target',
  'hash',
  'name',
  'body',
  'operation_kind',
  'coordinates',
  'timestamp',
  'expires_at',
] as const;

export const appDeploymentUsageOrder = [
  'target_id',
  'app_name',
  'app_version',
  'last_request',
] as const;

export function joinIntoSingleMessage(items: string[]): string {
  return items.join(delimiter);
}

type KeysOfArray<T extends readonly any[]> = T extends readonly (infer U)[] ? U : never;

// Important, it has to be in the same order as columns in the table
export function stringifyQueryOrMutationOperation(operation: ProcessedOperation): string {
  const mapper: Record<KeysOfArray<typeof operationsOrder>, any> = {
    organization: castValue(operation.organization),
    target: castValue(operation.target),
    timestamp: castDate(operation.timestamp),
    expires_at: castDate(operation.expiresAt),
    hash: castValue(operation.operationHash),
    ok: castValue(operation.execution.ok),
    errors: castValue(operation.execution.errorsTotal),
    duration: castValue(operation.execution.duration),
    client_name: castValue(operation.metadata?.client?.name),
    client_version: castValue(operation.metadata?.client?.version),
  };
  return Object.values(mapper).join(',');
}

export function stringifySubscriptionOperation(operation: ProcessedSubscriptionOperation): string {
  const mapper: Record<KeysOfArray<typeof subscriptionOperationsOrder>, any> = {
    organization: castValue(operation.organization),
    target: castValue(operation.target),
    timestamp: castDate(operation.timestamp),
    expires_at: castDate(operation.expiresAt),
    hash: castValue(operation.operationHash),
    client_name: castValue(operation.metadata?.client?.name),
    client_version: castValue(operation.metadata?.client?.version),
  };

  return Object.values(mapper).join(',');
}

export function stringifyRegistryRecord(record: ProcessedRegistryRecord): string {
  const mapper: Record<KeysOfArray<typeof registryOrder>, any> = {
    total: castValue(record.size),
    target: castValue(record.target),
    hash: castValue(record.hash),
    name: castValue(record.name),
    body: castValue(record.body),
    operation_kind: castValue(record.operation_kind),
    coordinates: castValue(record.coordinates),
    timestamp: castDate(record.timestamp),
    expires_at: castDate(record.expires_at),
  };

  return Object.values(mapper).join(',');
}

export function stringifyAppDeploymentUsageRecord(
  record: ProcessedAppDeploymentUsageRecord,
): string {
  const mapper: Record<KeysOfArray<typeof appDeploymentUsageOrder>, any> = {
    target_id: castValue(record.target),
    app_name: castValue(record.appName),
    app_version: castValue(record.appVersion),
    last_request: castDate(record.lastRequestTimestamp),
  };

  return Object.values(mapper).join(',');
}

function castDate(date: number): string {
  return cachedFormatDate(date).value;
}
