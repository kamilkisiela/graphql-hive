import { ChangeType } from '@graphql-inspector/core';
import { isSchemaChangeUsageTracked } from '../schema-change-usage-tracking.js';

function change(type: string, path: string | null, breakingChangeSchemaCoordinate = path) {
  return { type, path, breakingChangeSchemaCoordinate };
}

describe('isSchemaChangeUsageTracked', () => {
  it.each([
    [ChangeType.FieldRemoved, 'Query.products'],
    [ChangeType.FieldTypeChanged, 'ConversionRate.fromCurrency'],
    [ChangeType.FieldArgumentRemoved, 'Query.products.first'],
    [ChangeType.FieldArgumentTypeChanged, 'Query.products.first'],
    [ChangeType.InputFieldRemoved, 'ProductFilter.name'],
    [ChangeType.InputFieldTypeChanged, 'ProductFilter.name'],
    [ChangeType.EnumValueRemoved, 'Status.PENDING'],
  ])('tracks %s, whose coordinate the collector records', (type, path) => {
    expect(isSchemaChangeUsageTracked(change(type, path))).toBe(true);
  });

  it.each([
    // Usage lands on the fields that use a type, never on the type itself.
    [ChangeType.TypeRemoved, 'Currency', 'Currency'],
    // The name stays, so no field change carries its usage.
    [ChangeType.TypeKindChanged, 'Status', 'Status'],
    // An argument or input field that did not exist yet cannot have been sent.
    [ChangeType.FieldArgumentAdded, 'Query.products.region', 'Query.products.region'],
    [ChangeType.InputFieldAdded, 'ProductFilter.region', 'ProductFilter'],
    // Fragment type conditions are not collected.
    [ChangeType.UnionMemberRemoved, 'SearchResult', 'SearchResult'],
    [ChangeType.ObjectTypeInterfaceRemoved, 'Dog', 'Dog'],
    // Directives are not collected, even mid-path.
    [ChangeType.DirectiveRemoved, '@cacheControl', '@cacheControl'],
    [ChangeType.DirectiveUsageInputObjectAdded, 'ProductFilter.@oneOf', 'ProductFilter.@oneOf'],
  ])('does not track %s', (type, path, coordinate) => {
    expect(isSchemaChangeUsageTracked(change(type, path, coordinate))).toBe(false);
  });

  it('does not track a change without a coordinate, like a new query root type', () => {
    expect(isSchemaChangeUsageTracked(change(ChangeType.SchemaQueryTypeChanged, null))).toBe(false);
  });
});
