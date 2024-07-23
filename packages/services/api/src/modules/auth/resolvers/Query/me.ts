import { AuthManager } from '../../providers/auth-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const me: NonNullable<QueryResolvers['me']> = (_, __, { injector }) => {
  return injector.get(AuthManager).getCurrentUser();
};
