import { SchemaChangeUsageTracking, SeverityLevelType } from '@/gql/graphql';

type Change = {
  severityLevel: SeverityLevelType;
  isSafeBasedOnUsage: boolean;
  usageTracking: SchemaChangeUsageTracking;
};

/**
 * Breaking changes split three ways. "Safe based on usage" only holds where usage is recorded: a
 * change to something never recorded found no usage because none was looked for, so it is neither
 * safe nor not safe.
 */
export function changeSafetyStats(changes: ReadonlyArray<Change>) {
  const stats = { totalChanges: changes.length, breakingChanges: 0, notSafe: 0, unchecked: 0 };
  for (const change of changes) {
    if (change.severityLevel !== SeverityLevelType.Breaking) {
      continue;
    }
    stats.breakingChanges++;
    if (!change.isSafeBasedOnUsage) {
      stats.notSafe++;
    } else if (change.usageTracking !== SchemaChangeUsageTracking.Tracked) {
      stats.unchecked++;
    }
  }
  return stats;
}
