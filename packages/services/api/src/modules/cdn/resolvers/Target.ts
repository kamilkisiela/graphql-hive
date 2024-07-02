import { CdnProvider } from '../providers/cdn.provider';
import type { TargetResolvers } from './../../../__generated__/types.next';

export const Target: Pick<TargetResolvers, 'cdnAccessTokens' | 'cdnUrl'> = {
  cdnAccessTokens: async (target, args, context) => {
    const result = await context.injector.get(CdnProvider).getPaginatedCDNAccessTokensForTarget({
      targetId: target.id,
      projectId: target.projectId,
      organizationId: target.orgId,
      first: args.first ?? null,
      cursor: args.after ?? null,
    });

    return {
      edges: result.items,
      pageInfo: result.pageInfo,
    };
  },
  cdnUrl: (target, _args, context) => {
    return context.injector.get(CdnProvider).getCdnUrlForTarget(target.id);
  },
};
