import { ContractsManager } from '../providers/contracts-manager';
import { formatContractName } from '../providers/schema-publisher';
import type { ContractVersionResolvers } from './../../../__generated__/types';

export const ContractVersion: ContractVersionResolvers = {
  isComposable: contractVersion => {
    return contractVersion.schemaCompositionErrors === null;
  },
  hasSchemaChanges: (contractVersion, _, context) => {
    return context.injector
      .get(ContractsManager)
      .getHasSchemaChangesForContractVersion(contractVersion);
  },
  breakingSchemaChanges: (contractVersion, _, context) => {
    return context.injector
      .get(ContractsManager)
      .getBreakingChangesForContractVersion(contractVersion);
  },
  safeSchemaChanges: (contractVersion, _, context) => {
    return context.injector.get(ContractsManager).getSafeChangesForContractVersion(contractVersion);
  },
  compositeSchemaSDL: contractVersion => contractVersion.compositeSchemaSdl,
  supergraphSDL: contractVersion => contractVersion.supergraphSdl,
  previousContractVersion: (contractVersion, _, context) =>
    context.injector
      .get(ContractsManager)
      .getPreviousContractVersionForContractVersion(contractVersion),
  previousDiffableContractVersion: (contractVersion, _, context) =>
    context.injector
      .get(ContractsManager)
      .getDiffableContractVersionForContractVersion(contractVersion),
  isFirstComposableVersion: (contractVersion, _, context) =>
    context.injector
      .get(ContractsManager)
      .getIsFirstComposableVersionForContractVersion(contractVersion),
  schemaChanges: async (contractVersion, _, context) => {
    return context.injector.get(ContractsManager).getAllChangesForContractVersion(contractVersion);
  },
  contractName(contractVersion) {
    return formatContractName(contractVersion.contractName);
  },
};
