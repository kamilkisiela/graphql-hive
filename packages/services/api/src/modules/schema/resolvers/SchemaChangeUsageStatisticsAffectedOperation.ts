import { formatNumber, formatPercentage } from '../lib/number-formatting';
import type { SchemaChangeUsageStatisticsAffectedOperationResolvers } from './../../../__generated__/types';

/*
 * Note: This object type is generated because "SchemaChangeUsageStatisticsAffectedOperationMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const SchemaChangeUsageStatisticsAffectedOperation: Pick<
  SchemaChangeUsageStatisticsAffectedOperationResolvers,
  | 'affectedTargets'
  | 'count'
  | 'countFormatted'
  | 'hash'
  | 'name'
  | 'percentage'
  | 'percentageFormatted'
> = {
  countFormatted: async (operation, _arg, _ctx) => {
    return formatNumber(operation.count);
  },
  percentageFormatted: async (operation, _arg, _ctx) => {
    return formatPercentage(operation.percentage);
  },
};
