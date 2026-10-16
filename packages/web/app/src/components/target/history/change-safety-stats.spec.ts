import { SchemaChangeUsageTracking, SeverityLevelType } from '@/gql/graphql';
import { changeSafetyStats } from './change-safety-stats';

function breaking(isSafeBasedOnUsage: boolean, usageTracking: SchemaChangeUsageTracking) {
  return { severityLevel: SeverityLevelType.Breaking, isSafeBasedOnUsage, usageTracking };
}

const safe = {
  severityLevel: SeverityLevelType.Safe,
  isSafeBasedOnUsage: false,
  usageTracking: SchemaChangeUsageTracking.NotTracked,
};

describe('changeSafetyStats', () => {
  it('counts a breaking change with no recorded usage as not safe', () => {
    // The Currency rename: the type removal is untracked, the field change is tracked and safe.
    expect(
      changeSafetyStats([
        breaking(true, SchemaChangeUsageTracking.OnReferencingFields),
        breaking(true, SchemaChangeUsageTracking.Tracked),
        safe,
      ]),
    ).toEqual({ totalChanges: 3, breakingChanges: 2, notSafe: 1 });
  });

  it('counts a change found unsafe as not safe, whatever its tracking', () => {
    expect(
      changeSafetyStats([
        breaking(false, SchemaChangeUsageTracking.Tracked),
        breaking(false, SchemaChangeUsageTracking.NotTracked),
      ]),
    ).toEqual({ totalChanges: 2, breakingChanges: 2, notSafe: 2 });
  });

  it('calls everything safe only when every breaking change is tracked and safe', () => {
    expect(changeSafetyStats([breaking(true, SchemaChangeUsageTracking.Tracked), safe])).toEqual({
      totalChanges: 2,
      breakingChanges: 1,
      notSafe: 0,
    });
  });
});
