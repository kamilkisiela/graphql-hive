import { invariant } from './helpers';

type ValueType = 'string' | 'number' | 'boolean';

export function ensureEnv(key: string): string;
export function ensureEnv(key: string, valueType: 'string'): string;
export function ensureEnv(key: string, valueType: 'number'): number;
export function ensureEnv(key: string, valueType: 'boolean'): boolean;
export function ensureEnv(key: string, valueType?: ValueType) {
  let value = process.env[key];

  if (value === '<sync>') {
    value = undefined;
  }

  invariant(typeof value === 'string', `Missing "${key}" environment varariable`);

  switch (valueType) {
    case 'number':
      return parseInt(value, 10);
    case 'boolean':
      return value === 'true';
    default:
      return value;
  }
}
