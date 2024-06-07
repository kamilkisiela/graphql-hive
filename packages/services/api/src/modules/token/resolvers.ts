import { createConnection } from '../../shared/schema';
import type { TokenModule } from './__generated__/types';
import { TokenManager } from './providers/token-manager';

export const resolvers: TokenModule.Resolvers = {
  Token: {
    id(token) {
      return token.token;
    },
    alias(token) {
      return token.tokenAlias;
    },
  },
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
