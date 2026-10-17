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

  private breakingSchemaChangeToMetadataMap = new WeakMap<
    SchemaChangeType,
    ConditionalBreakingChangeMetadata
  >();

  registerMetadataForBreakingSchemaChange(
    schemaChange: SchemaChangeType,
    metadata: ConditionalBreakingChangeMetadata,
  ) {
    this.breakingSchemaChangeToMetadataMap.set(schemaChange, metadata);
  }

  async getUsageDataForBreakingSchemaChange(schemaChange: SchemaChangeType) {
    if (schemaChange.usageStatistics === null) {
      return null;
    }

    const metadata = this.breakingSchemaChangeToMetadataMap.get(schemaChange);

    // If metadata is missing, still return basic data with default values
    // This ensures the badge shows even when WeakMap lookup fails (e.g., after cache refresh)
    const totalRequestCount =
      metadata && Number.isFinite(metadata.usage.totalRequestCount)
        ? Math.max(1, metadata.usage.totalRequestCount)
        : 1;
    const targetIds = metadata?.settings.targets.map(target => target.id) ?? [];
    const targetNames = new Map(metadata?.settings.targets.map(target => [target.id, target.name]));
    // Names and totals come from the check's metadata.
    const toAffectedTargets = (
      counts: Array<{ id: string; count: number; operationCount?: number }> | undefined,
    ) =>
      (metadata &&
        counts?.map(({ id, count, operationCount }) => ({
          id,
          name: targetNames.get(id) ?? id,
          count,
          operationCount: operationCount ?? null,
          percentage: (count / totalRequestCount) * 100,
        }))) ||
      null;

    return {
      topAffectedOperations: schemaChange.usageStatistics.topAffectedOperations.map(operation => {
        const count = Number.isFinite(operation.count) ? operation.count : 0;
        const percentage = (count / totalRequestCount) * 100;
        return {
          ...operation,
          percentage,
          targetIds,
          affectedTargets: toAffectedTargets(operation.affectedTargets),
        };
      }),
      topAffectedClients: schemaChange.usageStatistics.topAffectedClients.map(client => {
        const count = Number.isFinite(client.count) ? client.count : 0;
        const percentage = (count / totalRequestCount) * 100;

        return {
          ...client,
          countFormatted: formatNumber(count),
          percentage,
          percentageFormatted: formatPercentage(percentage),
        };
      }),
      affectedTargets: toAffectedTargets(schemaChange.usageStatistics.affectedTargets),
      schemaCoordinate: schemaChange.usageStatistics.schemaCoordinate ?? null,
    };
  }
}
