import { TokenManager } from '../providers/token-manager';
import type { TargetResolvers } from './../../../__generated__/types.next';

export const Target: Pick<TargetResolvers, 'tokens' | '__isTypeOf'> = {
  tokens(target, _, { injector }) {
    return injector.get(TokenManager).getTokens({
      target: target.id,
      project: target.projectId,
      organization: target.orgId,
    });
  },
};
