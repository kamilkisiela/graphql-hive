import { ContractsManager } from '../providers/contracts-manager';
import type { ContractCheckResolvers } from './../../../__generated__/types.next';

export const ContractCheck: ContractCheckResolvers = {
  contractVersion: (contractCheck, _, context) => {
    return context.injector.get(ContractsManager).getContractVersionForContractCheck(contractCheck);
  },
  compositeSchemaSDL: contractCheck => contractCheck.compositeSchemaSdl,
  supergraphSDL: contractCheck => contractCheck.supergraphSdl,
  hasSchemaCompositionErrors: (contractCheck, _, { injector }) => {
    return injector
      .get(ContractsManager)
      .getHasSchemaCompositionErrorsForContractCheck(contractCheck);
  },
  hasUnapprovedBreakingChanges: (contractCheck, _, { injector }) => {
    return injector
      .get(ContractsManager)
      .getHasUnapprovedBreakingChangesForContractCheck(contractCheck);
  },
  hasSchemaChanges: (contractCheck, _, { injector }) => {
    return injector.get(ContractsManager).getHasSchemaChangesForContractCheck(contractCheck);
  },
};
