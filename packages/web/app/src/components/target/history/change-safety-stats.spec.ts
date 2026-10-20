import { SeverityLevelType } from '@/gql/graphql';
import { changeSafetyStats } from './change-safety-stats';

function breaking(isSafeBasedOnUsage: boolean, isUsageTracked: boolean) {
  return { severityLevel: SeverityLevelType.Breaking, isSafeBasedOnUsage, isUsageTracked };
}

const safe = {
  severityLevel: SeverityLevelType.Safe,
  isSafeBasedOnUsage: false,
  isUsageTracked: false,
};

describe('changeSafetyStats', () => {
  it('counts a breaking change with no recorded usage as not safe', () => {
    // The Currency rename: the type removal is untracked, the field change is tracked and safe.
    expect(changeSafetyStats([breaking(true, false), breaking(true, true), safe])).toEqual({
      totalChanges: 3,
      breakingChanges: 2,
      notSafe: 1,
    });
  });

  it('counts a change found unsafe as not safe, whatever its tracking', () => {
    expect(changeSafetyStats([breaking(false, true), breaking(false, false)])).toEqual({
      totalChanges: 2,
      breakingChanges: 2,
      notSafe: 2,
    });
  });

  it('calls everything safe only when every breaking change is tracked and safe', () => {
    expect(changeSafetyStats([breaking(true, true), safe])).toEqual({
      totalChanges: 2,
      breakingChanges: 1,
      notSafe: 0,
    });
  });
});
