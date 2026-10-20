import { SeverityLevelType } from '@/gql/graphql';

type Change = {
  severityLevel: SeverityLevelType;
  isSafeBasedOnUsage: boolean;
  isUsageTracked: boolean;
};

/**
 * "Safe based on usage" only holds where usage is recorded: a change to something never recorded
 * found no usage because none was looked for, so it counts as not safe.
 */
export function changeSafetyStats(changes: ReadonlyArray<Change>) {
  const stats = { totalChanges: changes.length, breakingChanges: 0, notSafe: 0 };
  for (const change of changes) {
    if (change.severityLevel !== SeverityLevelType.Breaking) {
      continue;
    }
    stats.breakingChanges++;
    if (!change.isSafeBasedOnUsage || !change.isUsageTracked) {
      stats.notSafe++;
    }
  }
  return stats;
}
