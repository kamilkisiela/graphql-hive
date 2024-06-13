import { AuthManager } from '../../../auth/providers/auth-manager';
import { TokenManager } from '../../providers/token-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const tokenInfo: NonNullable<QueryResolvers['tokenInfo']> = async (
  _parent,
  _arg,
  { injector },
) => {
  try {
    injector.get(AuthManager).ensureApiToken();
  } catch (error) {
    return {
      __typename: 'TokenNotFoundError',
      message: (error as Error).message,
    };
  }

  return injector.get(TokenManager).getCurrentToken();
};
