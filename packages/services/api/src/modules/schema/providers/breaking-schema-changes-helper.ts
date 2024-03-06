import { Injectable, Scope } from 'graphql-modules';
import type { ConditionalBreakingChangeMetadata, SchemaChangeType } from '@hive/storage';
import { formatNumber, formatPercentage } from '../lib/number-formatting';

/**
 * A class to avoid type mapping and drilling types by storing the data in a WeakMap instead...
 */
@Injectable({
  scope: Scope.Operation,
})
export class BreakingSchemaChangeUsageHelper {
  constructor() {}

  private breakingSchemaChangeToUsageMap = new WeakMap<
    SchemaChangeType,
    ConditionalBreakingChangeMetadata['usage']
  >();

  registerUsageDataForBreakingSchemaChange(
    schemaChange: SchemaChangeType,
    usage: ConditionalBreakingChangeMetadata['usage'],
  ) {
    this.breakingSchemaChangeToUsageMap.set(schemaChange, usage);
  }

  async getUsageDataForBreakingSchemaChange(schemaChange: SchemaChangeType) {
    if (schemaChange.usageStatistics === null) {
      return null;
    }

    const usageData = this.breakingSchemaChangeToUsageMap.get(schemaChange);

    if (usageData == null) {
      return null;
    }

    return {
      topAffectedOperations: schemaChange.usageStatistics.topAffectedOperations.map(operation => {
        const percentage = (operation.count / usageData.totalRequestCount) * 100;
        return {
          ...operation,
          countFormatted: formatNumber(operation.count),
          percentage,
          percentageFormatted: formatPercentage(percentage),
        };
      }),
      topAffectedClients: schemaChange.usageStatistics.topAffectedClients.map(client => {
        const percentage = (client.count / usageData.totalRequestCount) * 100;

        return {
          ...client,
          countFormatted: formatNumber(client.count),
          percentage,
          percentageFormatted: formatPercentage(percentage),
        };
      }),
    };
  }
}
