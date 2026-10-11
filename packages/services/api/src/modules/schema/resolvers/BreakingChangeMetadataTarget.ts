import { TargetManager } from '../../target/providers/target-manager';
import type { BreakingChangeMetadataTargetResolvers } from './../../../__generated__/types';

export const BreakingChangeMetadataTarget: BreakingChangeMetadataTargetResolvers = {
  // Through the permission-checked getter, so a token cannot reach a target it could not query.
  target: async (record, _, { injector }) => {
    const targetManager = injector.get(TargetManager);
    const target = await targetManager.getTargetById({ targetId: record.id }).catch(() => null);
    if (!target) {
      return null;
    }
    return targetManager
      .getTarget({
        organizationId: target.orgId,
        projectId: target.projectId,
        targetId: target.id,
      })
      .catch(() => null);
  },
  slug: async record => {
    return record.name;
  },
};
