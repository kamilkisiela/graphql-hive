/**
 * Generates `usage-report-v2.schema.json` from the TypeBox `ReportSchema` in `src/usage-processor-2.ts`.
 * The JSON schema is consumed by `sdk-rs` (via typify) as the source of truth for the usage report types.
 *
 * Usage: pnpm --filter @hive/usage generate:json-schema
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tb from '@sinclair/typebox';
import { ReportSchema } from '../src/usage-processor-2';

const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'usage-report-v2.schema.json',
);

/**
 * Custom TypeBox kinds (registered via `TypeRegistry`) have no JSON schema representation.
 * Map them to a portable equivalent.
 */
const customKinds: Record<string, Record<string, unknown>> = {
  UnixTimestampInMs: { type: 'integer', minimum: 0 },
};

/**
 * TypeBox emits `Record<string, T>` as `patternProperties` with a catch-all pattern.
 * `additionalProperties: T` is the equivalent, more readable form.
 */
const catchAllPattern = '^(.*)$';

/** Keys listed here come first (in this order), all other keys follow alphabetically. */
const keyOrder = [
  '$schema',
  '$ref',
  'title',
  'description',
  'type',
  'const',
  'enum',
  'format',
  'pattern',
  'minimum',
  'maximum',
  'minItems',
  'items',
  'anyOf',
  'properties',
  'required',
  'additionalProperties',
  'definitions',
];

function sortKeys(schema: Record<string, unknown>): Record<string, unknown> {
  const rank = (key: string) => {
    const index = keyOrder.indexOf(key);
    return index === -1 ? keyOrder.length : index;
  };
  return Object.fromEntries(
    Object.entries(schema).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)),
  );
}

/** Keys whose value maps names to schemas (as opposed to being a schema itself). */
const schemaMapKeys = new Set(['properties', 'patternProperties']);

/** Converts each schema of the map, but keeps the names in their original (source) order. */
function convertSchemaMap(map: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(map as Record<string, unknown>).map(([name, value]) => [
      name,
      toJSONSchema(value),
    ]),
  );
}

/** Titled sub-schemas are hoisted into `definitions` and referenced via `$ref` to avoid duplication. */
const definitions: Record<string, unknown> = {};

function toJSONSchema(schema: unknown, isRoot = false): unknown {
  if (Array.isArray(schema)) {
    return schema.map(item => toJSONSchema(item));
  }

  if (schema === null || typeof schema !== 'object') {
    return schema;
  }

  // Object.entries skips TypeBox symbol keys (Kind, OptionalKind, ...)
  const converted: Record<string, unknown> = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      schemaMapKeys.has(key) ? convertSchemaMap(value) : toJSONSchema(value),
    ]),
  );

  const kind = (schema as Record<symbol, unknown>)[tb.Kind];
  if (typeof kind === 'string' && kind in customKinds) {
    Object.assign(converted, customKinds[kind]);
  }

  const patternProperties = converted.patternProperties as Record<string, unknown> | undefined;
  if (
    patternProperties &&
    Object.keys(patternProperties).length === 1 &&
    catchAllPattern in patternProperties &&
    !('additionalProperties' in converted)
  ) {
    delete converted.patternProperties;
    converted.additionalProperties = patternProperties[catchAllPattern];
  }

  const { title, ...withoutTitle } = converted;
  if (isRoot || typeof title !== 'string') {
    return sortKeys(converted);
  }

  // The definition key already names the schema, so the title would be redundant.
  const definition = sortKeys(withoutTitle);
  if (title in definitions) {
    if (JSON.stringify(definitions[title]) !== JSON.stringify(definition)) {
      throw new Error(`Found different schemas with the same title "${title}".`);
    }
  } else {
    definitions[title] = definition;
  }

  return { $ref: `#/definitions/${title}` };
}

const rootSchema = toJSONSchema(ReportSchema, true) as Record<string, unknown>;

const jsonSchema = sortKeys({
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...rootSchema,
  definitions: Object.fromEntries(
    Object.entries(definitions).sort(([a], [b]) => a.localeCompare(b)),
  ),
});

writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2) + '\n');

console.log(`Wrote ${outputPath}`);
