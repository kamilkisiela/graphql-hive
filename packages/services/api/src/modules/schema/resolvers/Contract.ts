import { TargetManager } from '../../target/providers/target-manager';
import { ContractsManager } from '../providers/contracts-manager';
import type { ContractResolvers } from './../../../__generated__/types.next';

export const Contract: Pick<
  ContractResolvers,
  | 'contractName'
  | 'createdAt'
  | 'excludeTags'
  | 'id'
  | 'includeTags'
  | 'isDisabled'
  | 'removeUnreachableTypesFromPublicApiSchema'
  | 'target'
  | 'viewerCanDisableContract'
> = {
  target: (contract, _, context) => {
    return context.injector.get(TargetManager).getTargetById({
      targetId: contract.targetId,
    });
  },
  viewerCanDisableContract: (contract, _, context) => {
    return context.injector.get(ContractsManager).getViewerCanDisableContractForContract(contract);
  },
};
