import { CdnProvider } from '../../providers/cdn.provider';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const isCDNEnabled: NonNullable<QueryResolvers['isCDNEnabled']> = (_, __, { injector }) => {
  const cdn = injector.get(CdnProvider);

  return cdn.isEnabled();
};
