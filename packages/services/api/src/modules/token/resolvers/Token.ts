import type { TokenResolvers } from './../../../__generated__/types.next';

export const Token: TokenResolvers = {
  id(token) {
    return token.token;
  },
  alias(token) {
    return token.tokenAlias;
  },
};
