/* This file was automatically generated. DO NOT UPDATE MANUALLY. */
import type { Resolvers } from './../../__generated__/types.next';
import { createToken as Mutation_createToken } from './resolvers/Mutation/createToken';
import { deleteTokens as Mutation_deleteTokens } from './resolvers/Mutation/deleteTokens';
import { tokenInfo as Query_tokenInfo } from './resolvers/Query/tokenInfo';
import { tokens as Query_tokens } from './resolvers/Query/tokens';
import { Target } from './resolvers/Target';
import { Token } from './resolvers/Token';
import { TokenConnection } from './resolvers/TokenConnection';
import { TokenInfo } from './resolvers/TokenInfo';

export const resolvers: Resolvers = {
  Query: { tokenInfo: Query_tokenInfo, tokens: Query_tokens },
  Mutation: { createToken: Mutation_createToken, deleteTokens: Mutation_deleteTokens },

  Target: Target,
  Token: Token,
  TokenConnection: TokenConnection,
  TokenInfo: TokenInfo,
};
