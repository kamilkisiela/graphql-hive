import { isInputObjectType, isNonNullType, type GraphQLSchema } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { Change, ChangeType, diff, DiffRule, UsageHandler } from '@graphql-inspector/core';
import { HiveSchemaChangeModel, SchemaChangeType } from '@hive/storage';
import type { TargetSettings } from '../../../shared/entities';
import { createPeriod } from '../../../shared/helpers';
import { sentry } from '../../../shared/sentry';
import { OperationsReader } from '../../operations/providers/operations-reader';
import { Logger } from '../../shared/providers/logger';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class Inspector {
  private logger: Logger;

  constructor(
    logger: Logger,
    private operationsReader: OperationsReader,
  ) {
    this.logger = logger.child({ service: 'Inspector' });
  }

  @sentry('Inspector.diff')
  async diff(
    existing: GraphQLSchema,
    incoming: GraphQLSchema,
    /** If provided, the breaking changes will be enhanced with isSafeBasedOnUsage,  */
    settings: null | {
      period: number;
      percentage: number;
      targets: readonly string[];
      excludedClients: readonly string[];
    },
  ): Promise<Array<SchemaChangeType>> {
    this.logger.debug('Comparing Schemas');

    const changes = await diff(
      existing,
      incoming,
      settings ? [DiffRule.considerUsage] : undefined,
      settings
        ? {
            checkUsage: this.getCheckUsageForSettings({ incoming, existing, settings }),
          }
        : undefined,
    );

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

  private getCheckUsageForSettings(args: {
    incoming: GraphQLSchema;
    existing: GraphQLSchema;
    settings: {
      period: number;
      percentage: number;
      targets: readonly string[];
      excludedClients: readonly string[];
    };
  }): UsageHandler {
    return async fields => {
      this.logger.debug('Checking usage (fields=%s)', fields.length);
      const BREAKING = false;
      const NOT_BREAKING = true;
      const allUsed = fields.map(() => BREAKING);

      if (fields.length === 0) {
        this.logger.debug('Mark all as used');
        return allUsed;
      }

      this.logger.debug('Usage validation enabled');

      const fixedFields = fields.map(({ type, field, argument, meta }) => {
        if (type && field) {
          const typeDefinition = args.incoming.getType(type) || args.existing.getType(type);
          const change: Change<ChangeType> = meta.change;

          if (typeDefinition && isInputObjectType(typeDefinition)) {
            const typeBefore = args.existing.getType(type);
            const typeAfter = args.incoming.getType(type);

            if (isInputObjectType(typeBefore) && isInputObjectType(typeAfter)) {
              const fieldAfter = typeAfter.getFields()[field];
              // Adding a non-nullable input field to a used input object type is a breaking change.
              // That's why we need to check if the input type is used, not the field itself (as it's new)
              if (change.type === ChangeType.InputFieldAdded && isNonNullType(fieldAfter.type)) {
                return {
                  type,
                };
              }
            }
          }
        }

        return {
          type,
          field,
          argument,
        };
      });

      const statsList = await this.getSchemaCoordinateStatistics({
        settings: args.settings,
        fields: fixedFields,
      });

      if (!statsList) {
        return allUsed;
      }

      this.logger.debug('Got the stats');

      return fixedFields.map(function useStats({
        type,
        field,
        argument,
      }: {
        type: string;
        field?: string;
        argument?: string;
      }) {
        const stats = statsList.find(
          s => s.field === field && s.type === type && s.argument === argument,
        );

        if (!stats) {
          return NOT_BREAKING;
        }

        const aboveThreshold = stats.percentage > args.settings.percentage;
        return aboveThreshold ? BREAKING : NOT_BREAKING;
      });
    };
  }

  private async getSchemaCoordinateStatistics({
    fields,
    settings,
  }: {
    settings: Omit<TargetSettings['validation'], 'enabled'>;
    fields: ReadonlyArray<{
      type: string;
      field?: string | null;
      argument?: string | null;
    }>;
  }) {
    try {
      return await this.operationsReader.readFieldListStats({
        fields,
        period: createPeriod(`${settings.period}d`),
        targetIds: settings.targets,
        excludedClients: settings.excludedClients,
      });
    } catch (error: any) {
      this.logger.error(`Failed to read stats`, error);
    }
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
