import { TargetManager } from '../../target/providers/target-manager';
import type { BreakingChangeMetadataTargetResolvers } from './../../../__generated__/types.next';

export const BreakingChangeMetadataTarget: BreakingChangeMetadataTargetResolvers = {
  target: (record, _, { injector }) => {
    return injector
      .get(TargetManager)
      .getTargetById({ targetId: record.id })
      .catch(() => null);
  },
};
