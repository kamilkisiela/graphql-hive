import * as dateFnsTz from 'date-fns-tz';
import LRU from 'tiny-lru';
import { cache } from './helpers';
import type { ProcessedRegistryRecord, ProcessedOperation } from '@hive/usage-common';

const delimiter = '\n';
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatDate(date: number): string {
  return dateFnsTz.formatInTimeZone(dateFnsTz.zonedTimeToUtc(date, timezone), 'UTC', 'yyyy-MM-dd HH:mm:ss');
}

function dateCacheKey(date: number): string {
  return String(Math.floor(date / 1000) * 1000);
}

const cachedFormatDate = cache(formatDate, dateCacheKey, LRU(50_000));

export const operationsOrder = [
  'target',
  'timestamp',
  'expires_at',
  'hash',
  'ok',
  'errors',
  'duration',
  'schema',
  'client_name',
  'client_version',
] as const;

export const registryOrder = ['target', 'hash', 'name', 'body', 'operation', 'inserted_at'] as const;

export function joinIntoSingleMessage(items: string[]): string {
  return items.join(delimiter);
}

type KeysOfArray<T extends readonly any[]> = T extends readonly (infer U)[] ? U : never;

// Important, it has to be in the same order as columns in the table
export function stringifyOperation(operation: ProcessedOperation): string {
  const mapper: Record<KeysOfArray<typeof operationsOrder>, any> = {
    target: castValue(operation.target),
    timestamp: castDate(operation.timestamp),
    expires_at: castDate(operation.expiresAt),
    hash: castValue(operation.operationHash),
    ok: castValue(operation.execution.ok),
    errors: castValue(operation.execution.errorsTotal),
    duration: castValue(operation.execution.duration),
    schema: castValue(operation.fields),
    client_name: castValue(operation.metadata?.client?.name),
    client_version: castValue(operation.metadata?.client?.version),
  };
  return Object.values(mapper).join(',');
}

export function stringifyRegistryRecord(record: ProcessedRegistryRecord): string {
  const mapper: Record<KeysOfArray<typeof registryOrder>, any> = {
    target: castValue(record.target),
    hash: castValue(record.hash),
    name: castValue(record.name),
    body: castValue(record.body),
    operation: castValue(record.operation),
    inserted_at: castDate(record.inserted_at),
  };

  return Object.values(mapper).join(',');
}

function castDate(date: number): string {
  return cachedFormatDate(date).value;
}

function castValue(value: boolean): number;
function castValue(value: string): string;
function castValue(value: number): number;
function castValue(value: any[]): string;
function castValue(value?: any): string;
function castValue(value: undefined): string;
function castValue(value?: any) {
  if (typeof value === 'boolean') {
    return castValue(value ? 1 : 0);
  }

  if (typeof value === 'string') {
    // According to https://datatracker.ietf.org/doc/html/rfc4180
    // if double-quotes are used to enclose fields,
    // then a double-quote appearing inside a field
    // must be escaped by preceding it with another double quote
    return `"${value.replace(/"/g, '""')}"`;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value)) {
    return `"[${value.map(val => `'${val}'`).join(',')}]"`;
  }

  return '\\N'; // NULL is \N
  // Yes, it's ᴺᵁᴸᴸ not NULL :) This is what JSONStringsEachRow does for NULLs
}
