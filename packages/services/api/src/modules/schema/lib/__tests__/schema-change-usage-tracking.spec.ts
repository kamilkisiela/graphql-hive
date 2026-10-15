import { ChangeType } from '@graphql-inspector/core';
import { getSchemaChangeUsageTracking } from '../schema-change-usage-tracking.js';

function change(type: string, path: string | null, breakingChangeSchemaCoordinate = path) {
  return { type, path, breakingChangeSchemaCoordinate };
}

describe('getSchemaChangeUsageTracking', () => {
  it.each([
    [ChangeType.FieldRemoved, 'Query.products'],
    [ChangeType.FieldTypeChanged, 'ConversionRate.fromCurrency'],
    [ChangeType.FieldArgumentRemoved, 'Query.products.first'],
    [ChangeType.FieldArgumentTypeChanged, 'Query.products.first'],
    [ChangeType.InputFieldRemoved, 'ProductFilter.name'],
    [ChangeType.InputFieldTypeChanged, 'ProductFilter.name'],
    [ChangeType.EnumValueRemoved, 'Status.PENDING'],
  ])('tracks %s, whose coordinate the collector records', (type, path) => {
    expect(getSchemaChangeUsageTracking(change(type, path))).toBe('TRACKED');
  });

  it('points a removed type at the fields that use it', () => {
    expect(getSchemaChangeUsageTracking(change(ChangeType.TypeRemoved, 'Currency'))).toBe(
      'ON_REFERENCING_FIELDS',
    );
  });

  it.each([
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
    expect(getSchemaChangeUsageTracking(change(type, path, coordinate))).toBe('NOT_TRACKED');
  });

  it('does not track a change without a coordinate, like a new query root type', () => {
    expect(getSchemaChangeUsageTracking(change(ChangeType.SchemaQueryTypeChanged, null))).toBe(
      'NOT_TRACKED',
    );
  });

  it('gives every Inspector change type a value', () => {
    for (const type of Object.values(ChangeType)) {
      expect(['TRACKED', 'ON_REFERENCING_FIELDS', 'NOT_TRACKED']).toContain(
        getSchemaChangeUsageTracking(change(type, 'Some.coordinate')),
      );
    }
  });
});
