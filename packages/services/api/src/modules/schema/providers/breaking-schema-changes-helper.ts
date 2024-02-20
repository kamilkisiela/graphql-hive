import { Injectable, Scope } from 'graphql-modules';
import type { ConditionalBreakingChangeMetadata, SchemaChangeType } from '@hive/storage';

/**
 * A class to avoid type mapping and drilling types by storing the data in a WeakMap instead...
 */
@Injectable({
  scope: Scope.Operation,
})
export class BreakingSchemaChangeUsageHelper {
  constructor() {}

  private breakingSchemaChangeToUsageMap = new Map<
    string,
    ConditionalBreakingChangeMetadata['usage']
  >();

  registerUsageDataForBreakingSchemaChange(
    schemaChange: SchemaChangeType,
    usage: ConditionalBreakingChangeMetadata['usage'],
  ) {
    this.breakingSchemaChangeToUsageMap.set(schemaChange.id, usage);
  }

  async getUsageDataForBreakingSchemaChange(schemaChange: SchemaChangeType) {
    if (schemaChange.usageStatistics === null) {
      return null;
    }

    const usageData = this.breakingSchemaChangeToUsageMap.get(schemaChange.id);

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

function formatPercentage(percentage: number): string {
  if (percentage < 0.01) {
    return '<0.01%';
  }
  return `${percentage.toFixed(2)}%`;
}

const symbols = ['', 'K', 'M', 'G', 'T', 'P', 'E'];

function formatNumber(value: number): string {
  // what tier? (determines SI symbol)
  const tier = (Math.log10(Math.abs(value)) / 3) | 0;

  // if zero, we don't need a suffix
  if (tier === 0) {
    return String(value);
  }

  // get suffix and determine scale
  const suffix = symbols[tier];
  const scale = Math.pow(10, tier * 3);

  // scale the number
  const scaled = value / scale;

  // format number and add suffix
  return scaled.toFixed(1) + suffix;
}
