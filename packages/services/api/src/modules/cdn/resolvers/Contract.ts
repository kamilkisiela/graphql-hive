import { CdnProvider } from '../providers/cdn.provider';
import type { ContractResolvers } from './../../../__generated__/types';

export const Contract: Pick<ContractResolvers, 'cdnUrl'> = {
  cdnUrl: (contract, _, context) => {
    return context.injector.get(CdnProvider).getCdnUrlForContractGraph(contract);
  },
};
