import type { SchemaChangeMapper } from '../module.graphql.mappers';
import { ChangeType } from '@graphql-inspector/core';

export type SchemaChangeUsageTracking = 'TRACKED' | 'ON_REFERENCING_FIELDS' | 'NOT_TRACKED';

type InspectorChangeType = (typeof ChangeType)[keyof typeof ChangeType];

/**
 * Changes whose coordinate is one the usage collector reports usage for: a field, an argument, an
 * input field or an enum value (packages/libraries/core/src/client/collect-schema-coordinates.ts).
 * Every change has a coordinate; for the others, usage is never recorded under it.
 */
const TRACKED = new Set<InspectorChangeType>([
  ChangeType.FieldRemoved,
  ChangeType.FieldTypeChanged,
  ChangeType.FieldArgumentRemoved,
  ChangeType.FieldArgumentTypeChanged,
  ChangeType.InputFieldRemoved,
  ChangeType.InputFieldTypeChanged,
  ChangeType.EnumValueRemoved,
]);

/**
 * Whether a breaking change's "safe based on usage" can be trusted. Everything else defaults to
 * NOT_TRACKED: types, union members, interfaces and directives are never recorded, and an argument
 * or input field that did not exist yet cannot have been sent. Only meaningful for breaking changes.
 */
export function getSchemaChangeUsageTracking(
  change: Pick<SchemaChangeMapper, 'type' | 'path' | 'breakingChangeSchemaCoordinate'>,
): SchemaChangeUsageTracking {
  if ((change.breakingChangeSchemaCoordinate ?? change.path) == null) {
    return 'NOT_TRACKED';
  }
  if (TRACKED.has(change.type as InspectorChangeType)) {
    return 'TRACKED';
  }
  // Usage lands on the fields that return or take the type, never on the type itself.
  if (change.type === ChangeType.TypeRemoved) {
    return 'ON_REFERENCING_FIELDS';
  }
  return 'NOT_TRACKED';
}
