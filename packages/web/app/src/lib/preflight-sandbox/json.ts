export type JSONPrimitive = boolean | null | string | number;
export type JSONObject = { [key: string]: JSONValue };
export type JSONValue = JSONPrimitive | JSONValue[] | JSONObject;

function isJSONValue(value: unknown): value is JSONValue {
  return (
    (Array.isArray(value) && value.every(isJSONValue)) ||
    isJSONObject(value) ||
    isJSONPrimitive(value)
  );
}

export function isJSONObject(value: unknown): value is JSONObject {
  return (
    typeof value === 'object' &&
    !!value &&
    !Array.isArray(value) &&
    Object.values(value).every(isJSONValue)
  );
}

export function isJSONPrimitive(value: unknown): value is JSONPrimitive {
  return (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    value === null
  );
}
