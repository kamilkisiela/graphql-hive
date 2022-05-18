type ValueType = 'string' | 'number' | 'boolean';

const prefix = 'Invariant failed';

// Throw an error if the condition fails
// > Not providing an inline default argument for message as the result is smaller
export function invariant(
  condition: any,
  // Can provide a string, or a function that returns a string for cases where
  // the message takes a fair amount of effort to compute
  message?: string | (() => string)
): asserts condition {
  if (condition) {
    return;
  }
  // Condition not passed

  // When not in production we allow the message to pass through
  // *This block will be removed in production builds*

  const provided: string | undefined =
    typeof message === 'function' ? message() : message;

  // Options:
  // 1. message provided: `${prefix}: ${provided}`
  // 2. message not provided: prefix
  const value: string = provided ? `${prefix}: ${provided}` : prefix;
  throw new Error(value);
}

export function ensureEnv(key: string): string;
export function ensureEnv(key: string, valueType: 'string'): string;
export function ensureEnv(key: string, valueType: 'number'): number;
export function ensureEnv(key: string, valueType: 'boolean'): boolean;
export function ensureEnv(key: string, valueType?: ValueType) {
  let value = process.env[key];

  if (value === '<sync>') {
    value = undefined;
  }

  invariant(typeof value === 'string', `Missing "${key}" environment variable`);

  switch (valueType) {
    case 'number':
      return parseInt(value, 10);
    case 'boolean':
      return value === 'true';
    default:
      return value;
  }
}
