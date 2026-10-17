import { Session } from '../../auth/lib/authz';
import { TargetManager } from '../../target/providers/target-manager';
import type { BreakingChangeMetadataTargetResolvers } from './../../../__generated__/types';

export const BreakingChangeMetadataTarget: BreakingChangeMetadataTargetResolvers = {
  // The same check as the public `target` query, so a token cannot reach a target it could not query.
  target: async (record, _, { injector }) => {
    const target = await injector
      .get(TargetManager)
      .getTargetById({ targetId: record.id })
      .catch(() => null);
    if (!target) {
      return null;
    }
    const allowed = await injector.get(Session).canPerformAction({
      action: 'project:describe',
      organizationId: target.orgId,
      params: { organizationId: target.orgId, projectId: target.projectId },
    });
    return allowed ? target : null;
  },
  slug: async record => {
    return record.name;
  },
};
