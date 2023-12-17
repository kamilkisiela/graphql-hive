import { isInputObjectType, isNonNullType, type GraphQLSchema } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { ChangeType, diff, DiffRule } from '@graphql-inspector/core';
import { HiveSchemaChangeModel, SchemaChangeType } from '@hive/storage';
import type * as Types from '../../../__generated__/types';
import type { TargetSettings } from '../../../shared/entities';
import { createPeriod } from '../../../shared/helpers';
import { sentry } from '../../../shared/sentry';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { Logger } from '../../shared/providers/logger';
import { TargetManager } from '../../target/providers/target-manager';

@Injectable({
  scope: Scope.Operation,
})
export class Inspector {
  private logger: Logger;

  constructor(
    logger: Logger,
    private operationsManager: OperationsManager,
    private targetManager: TargetManager,
  ) {
    this.logger = logger.child({ service: 'Inspector' });
  }

  @sentry('Inspector.diff')
  async diff(
    existing: GraphQLSchema,
    incoming: GraphQLSchema,
    selector?: Types.TargetSelector,
  ): Promise<Array<SchemaChangeType>> {
    this.logger.debug('Comparing Schemas');

    const changes = await diff(existing, incoming, [DiffRule.considerUsage], {
      checkUsage: async fields => {
        this.logger.debug('Checking usage (fields=%s)', fields.length);
        const BREAKING = false;
        const NOT_BREAKING = true;
        const allUsed = fields.map(() => BREAKING);

        if (!(selector && 'organization' in selector) || fields.length === 0) {
          this.logger.debug('Mark all as used');
          return allUsed;
        }

        const settings = await this.getSettings({ selector });

        if (!settings) {
          return allUsed;
        }

        this.logger.debug('Usage validation enabled');

        const fixedFields = fields.map(({type,  field, argument}) => {
          if (type && field) {
            const typeDefinition = incoming.getType(type) || existing.getType(type);
            

            if (typeDefinition && isInputObjectType(typeDefinition)) {
              const typeBefore = existing.getType(type);
              const typeAfter = incoming.getType(type);

              if (isInputObjectType(typeBefore) && isInputObjectType(typeAfter)) {
                const fieldAfter = typeAfter.getFields()[field];
                // Adding a non-nullable input field to a used input object type is a breaking change.
                // That's why we need to check if the input type is used, not the field itself (as it's new)
                if (type === ChangeType.InputFieldAdded && isNonNullType(fieldAfter.type)) {
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

        const statsList = await this.getStats({
          selector,
          settings,
          fields: fixedFields,
        });

        if (!statsList) {
          return allUsed;
        }

        this.logger.debug('Got the stats');

        function useStats({
          type,
          field,
          argument,
        }: {
          type: string;
          field?: string;
          argument?: string;
        }) {
          const stats = statsList!.find(
            s => s.field === field && s.type === type && s.argument === argument,
          );

          if (!stats) {
            return NOT_BREAKING;
          }

          const aboveThreshold = stats.percentage > settings!.validation.percentage;
          return aboveThreshold ? BREAKING : NOT_BREAKING;
        }

        return fixedFields.map(useStats);
      },
    });

    return changes
      .map(change =>
        HiveSchemaChangeModel.parse({
          type: change.type,
          meta: change.meta,
          isSafeBasedOnUsage: change.criticality.isSafeBasedOnUsage,
        }),
      )
      .sort((a, b) => a.criticality.localeCompare(b.criticality));
  }

  private async getSettings({ selector }: { selector: Types.TargetSelector }) {
    try {
      const settings = await this.targetManager.getTargetSettings({
        ...selector,
        unsafe__itIsMeInspector: true,
      });

      if (!settings.validation.enabled) {
        this.logger.debug('Usage validation disabled');
        this.logger.debug('Mark all as used');
        return null;
      }

      if (settings.validation.enabled && settings.validation.targets.length === 0) {
        this.logger.debug('Usage validation enabled but no targets to check against');
        this.logger.debug('Mark all as used');
        return null;
      }

      return settings;
    } catch (error: any) {
      this.logger.error(`Failed to get settings`, error);
      return null;
    }
  }

  private async getStats({
    fields,
    settings,
    selector,
  }: {
    settings: TargetSettings;
    selector: Types.TargetSelector;
    fields: ReadonlyArray<{
      type: string;
      field?: string | null;
      argument?: string | null;
    }>;
  }) {
    try {
      return await this.operationsManager.readFieldListStats({
        fields,
        period: createPeriod(`${settings.validation.period}d`),
        target: settings.validation.targets,
        excludedClients: settings.validation.excludedClients,
        project: selector.project,
        organization: selector.organization,
        unsafe__itIsMeInspector: true,
      });
    } catch (error: any) {
      this.logger.error(`Failed to read stats`, error);
    }
  }
}
