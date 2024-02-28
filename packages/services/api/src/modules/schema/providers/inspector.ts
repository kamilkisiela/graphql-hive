import { type GraphQLSchema } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { Change, ChangeType, diff } from '@graphql-inspector/core';
import { HiveSchemaChangeModel, SchemaChangeType } from '@hive/storage';
import { sentry } from '../../../shared/sentry';
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

  @sentry('Inspector.diff')
  async diff(existing: GraphQLSchema, incoming: GraphQLSchema): Promise<Array<SchemaChangeType>> {
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
