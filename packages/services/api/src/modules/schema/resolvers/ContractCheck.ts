import { ContractsManager } from '../providers/contracts-manager';
import type { ContractCheckResolvers } from './../../../__generated__/types';

export const ContractCheck: ContractCheckResolvers = {
  contractVersion: (contractCheck, _, context) => {
    return context.injector.get(ContractsManager).getContractVersionForContractCheck(contractCheck);
  },
  contractName(contractCheck) {
    return contractCheck.contractName;
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
  schemaChanges: async (contractCheck, _arg, _ctx) => {
    if (contractCheck.safeSchemaChanges == null && contractCheck.breakingSchemaChanges == null) {
      return null;
    }

    return [
      ...(contractCheck.breakingSchemaChanges ?? []),
      ...(contractCheck.safeSchemaChanges ?? []),
    ];
  },
  async baseline(contractCheck, _arg, { injector }) {
    return injector.get(ContractsManager).getContractBaselineForContractCheck(contractCheck);
  },
};
