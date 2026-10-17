import { formatNumber, formatPercentage } from '../lib/number-formatting';
import type { SchemaChangeUsageStatisticsAffectedTargetResolvers } from './../../../__generated__/types';

export const SchemaChangeUsageStatisticsAffectedTarget: SchemaChangeUsageStatisticsAffectedTargetResolvers =
  {
    target: affected => ({ id: affected.id, name: affected.name }),
    countFormatted: affected => formatNumber(affected.count),
    percentageFormatted: affected => formatPercentage(affected.percentage),
  };
