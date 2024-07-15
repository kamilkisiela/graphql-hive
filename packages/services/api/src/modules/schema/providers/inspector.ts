import {
  GraphQLFieldMap,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isIntrospectionType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLSchema,
} from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { Change, ChangeType, diff } from '@graphql-inspector/core';
import { traceFn } from '@hive/service-common';
import { HiveSchemaChangeModel } from '@hive/storage';
import { Logger } from '../../shared/providers/logger';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Inspector {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'Inspector' });
  }

  @traceFn('Inspector.diff', {
    resultAttributes: result => ({
      'hive.diff.changes.count': result.length,
    }),
  })
  async diff(existing: GraphQLSchema, incoming: GraphQLSchema) {
    this.logger.debug('Comparing Schemas');

    const changes = await diff(existing, incoming);

    return changes
      .filter(dropTrimmedDescriptionChangedChange)
      .map(change =>
        HiveSchemaChangeModel.parse({
          type: change.type,
          meta: change.meta,
          isSafeBasedOnUsage: change.criticality.isSafeBasedOnUsage,
        }),
      )
      .sort((a, b) => a.criticality.localeCompare(b.criticality));
  }
}

/**
 * In case of <any>DescriptionChanged change, it normalizes the before and after descriptions and compares them.
 * If they are equal, it means that the change is no longer relevant and can be dropped.
 * All other changes are kept.
 */
function dropTrimmedDescriptionChangedChange(change: Change<ChangeType>): boolean {
  return (
    matchChange(change, {
      [ChangeType.DirectiveArgumentDescriptionChanged]: change =>
        shouldKeepDescriptionChangedChange(
          change,
          'newDirectiveArgumentDescription',
          'oldDirectiveArgumentDescription',
        ),
      [ChangeType.DirectiveDescriptionChanged]: change => {
        return shouldKeepDescriptionChangedChange(
          change,
          'oldDirectiveDescription',
          'newDirectiveDescription',
        );
      },
      [ChangeType.EnumValueDescriptionChanged]: change =>
        shouldKeepDescriptionChangedChange(
          change,
          'oldEnumValueDescription',
          'newEnumValueDescription',
        ),
      [ChangeType.FieldArgumentDescriptionChanged]: change => {
        return shouldKeepDescriptionChangedChange(change, 'newDescription', 'oldDescription');
      },
      [ChangeType.FieldDescriptionChanged]: change => {
        return shouldKeepDescriptionChangedChange(change, 'newDescription', 'oldDescription');
      },
      [ChangeType.InputFieldDescriptionChanged]: change => {
        return shouldKeepDescriptionChangedChange(
          change,
          'newInputFieldDescription',
          'oldInputFieldDescription',
        );
      },
      [ChangeType.TypeDescriptionChanged]: change => {
        return shouldKeepDescriptionChangedChange(
          change,
          'newTypeDescription',
          'oldTypeDescription',
        );
      },
    }) ?? true
  );
}

function trimDescription(description: unknown): string {
  if (typeof description !== 'string') {
    return '';
  }

  return description.trim();
}

// Limits the name of properties to only those that ends with Description
type PropEndsWith<T, E extends string> = T extends `${any}${E}` ? T : never;

function shouldKeepDescriptionChangedChange<
  T extends ChangeType,
  TO extends PropEndsWith<keyof Change<T>['meta'], 'Description'>,
  // Prevents comparing values of the same key (e.g. newDescription, newDescription will result in TS error)
  TN extends Exclude<PropEndsWith<keyof Change<T>['meta'], 'Description'>, TO>,
>(change: Change<T>, oldKey: TO, newKey: TN) {
  return trimDescription(change.meta[oldKey]) !== trimDescription(change.meta[newKey]);
}

function matchChange<R, T extends ChangeType>(
  change: Change<T>,
  pattern: {
    [K in T]?: (change: Change<K>) => R;
  },
) {
  if (change.type in pattern) {
    return pattern[change.type]?.(change);
  }
}

export type SchemaCoordinatesDiffResult = {
  /**
   * Coordinates that are in incoming but not in existing (including deprecated ones)
   */
  added: Set<string>;
  /**
   * Coordinates that are in existing but not in incoming (including deprecated ones)
   */
  deleted: Set<string>;
  /**
   * Coordinates that are deprecated in incoming, but were not deprecated in existing or non-existent
   */
  deprecated: Set<string>;
  /**
   * Coordinates that exists in incoming and are not deprecated in incoming, but were deprecated in existing
   */
  undeprecated: Set<string>;
};

export function diffSchemaCoordinates(
  existingSchema: GraphQLSchema | null,
  incomingSchema: GraphQLSchema,
): SchemaCoordinatesDiffResult {
  const before = existingSchema
    ? getSchemaCoordinates(existingSchema)
    : { coordinates: new Set<string>(), deprecated: new Set<string>() };
  const after = getSchemaCoordinates(incomingSchema);

  const added = after.coordinates.difference(before.coordinates);
  const deleted = before.coordinates.difference(after.coordinates);
  const deprecated = after.deprecated.difference(before.deprecated);
  const undeprecated = before.deprecated
    .difference(after.deprecated)
    .intersection(after.coordinates);

  return {
    added,
    deleted,
    deprecated,
    undeprecated,
  };
}

export function getSchemaCoordinates(schema: GraphQLSchema): {
  coordinates: Set<string>;
  deprecated: Set<string>;
} {
  const coordinates = new Set<string>();
  const deprecated = new Set<string>();

  const typeMap = schema.getTypeMap();

  for (const typeName in typeMap) {
    const typeDefinition = typeMap[typeName];

    if (isIntrospectionType(typeDefinition)) {
      continue;
    }

    coordinates.add(typeName);

    if (isObjectType(typeDefinition) || isInterfaceType(typeDefinition)) {
      visitSchemaCoordinatesOfGraphQLFieldMap(
        typeName,
        typeDefinition.getFields(),
        coordinates,
        deprecated,
      );
    } else if (isInputObjectType(typeDefinition)) {
      const fieldMap = typeDefinition.getFields();
      for (const fieldName in fieldMap) {
        const fieldDefinition = fieldMap[fieldName];

        coordinates.add(`${typeName}.${fieldName}`);
        if (fieldDefinition.deprecationReason) {
          deprecated.add(`${typeName}.${fieldName}`);
        }
      }
    } else if (isUnionType(typeDefinition)) {
      coordinates.add(typeName);
      for (const member of typeDefinition.getTypes()) {
        coordinates.add(`${typeName}.${member.name}`);
      }
    } else if (isEnumType(typeDefinition)) {
      const values = typeDefinition.getValues();
      for (const value of values) {
        coordinates.add(`${typeName}.${value.name}`);
        if (value.deprecationReason) {
          deprecated.add(`${typeName}.${value.name}`);
        }
      }
    } else if (isScalarType(typeDefinition)) {
      coordinates.add(typeName);
    } else {
      throw new Error(`Unsupported type kind ${typeName}`);
    }
  }

  return {
    coordinates,
    deprecated,
  };
}

function visitSchemaCoordinatesOfGraphQLFieldMap(
  typeName: string,
  fieldMap: GraphQLFieldMap<any, any>,
  coordinates: Set<string>,
  deprecated: Set<string>,
) {
  for (const fieldName in fieldMap) {
    const fieldDefinition = fieldMap[fieldName];

    coordinates.add(`${typeName}.${fieldName}`);
    if (fieldDefinition.deprecationReason) {
      deprecated.add(`${typeName}.${fieldName}`);
    }

    for (const arg of fieldDefinition.args) {
      coordinates.add(`${typeName}.${fieldName}.${arg.name}`);
      if (arg.deprecationReason) {
        deprecated.add(`${typeName}.${fieldName}.${arg.name}`);
      }
    }
  }
}
