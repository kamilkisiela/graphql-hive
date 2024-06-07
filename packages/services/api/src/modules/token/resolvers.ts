import { createConnection } from '../../shared/schema';
import type { TokenModule } from './__generated__/types';
import { TokenManager } from './providers/token-manager';

export const resolvers: TokenModule.Resolvers = {
  Target: {
    tokens(target, _, { injector }) {
      return injector.get(TokenManager).getTokens({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
  },
  TokenConnection: createConnection(),
};
