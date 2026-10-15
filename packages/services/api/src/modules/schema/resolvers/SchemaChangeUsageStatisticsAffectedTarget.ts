import type { SchemaChangeUsageStatisticsAffectedTargetResolvers } from './../../../__generated__/types';

/*
 * Note: This object type is generated because "SchemaChangeUsageStatisticsAffectedTargetMapper" is declared. This is to ensure runtime safety.
 *
 * When a mapper is used, it is possible to hit runtime errors in some scenarios:
 * - given a field name, the schema type's field type does not match mapper's field type
 * - or a schema type's field does not exist in the mapper's fields
 *
 * If you want to skip this file generation, remove the mapper or update the pattern in the `resolverGeneration.object` config.
 */
export const SchemaChangeUsageStatisticsAffectedTarget: SchemaChangeUsageStatisticsAffectedTargetResolvers =
  {
    /* Implement SchemaChangeUsageStatisticsAffectedTarget resolver logic here */
    countFormatted: async (_parent, _arg, _ctx) => {
      /* SchemaChangeUsageStatisticsAffectedTarget.countFormatted resolver is required because SchemaChangeUsageStatisticsAffectedTarget.countFormatted exists but SchemaChangeUsageStatisticsAffectedTargetMapper.countFormatted does not */
    },
    percentageFormatted: async (_parent, _arg, _ctx) => {
      /* SchemaChangeUsageStatisticsAffectedTarget.percentageFormatted resolver is required because SchemaChangeUsageStatisticsAffectedTarget.percentageFormatted exists but SchemaChangeUsageStatisticsAffectedTargetMapper.percentageFormatted does not */
    },
    target: async (_parent, _arg, _ctx) => {
      /* SchemaChangeUsageStatisticsAffectedTarget.target resolver is required because SchemaChangeUsageStatisticsAffectedTarget.target exists but SchemaChangeUsageStatisticsAffectedTargetMapper.target does not */
    },
  };
