import { createDummyConnection } from '../../shared/schema';
import { TargetManager } from '../target/providers/target-manager';
import type { SchemaModule } from './__generated__/types';
import { ContractsManager } from './providers/contracts-manager';

export const resolvers: SchemaModule.Resolvers = {
  SchemaPolicyWarningConnection: createDummyConnection(warning => ({
    ...warning,
    start: {
      column: warning.column,
      line: warning.line,
    },
    end:
      warning.endColumn && warning.endLine
        ? {
            column: warning.endColumn,
            line: warning.endLine,
          }
        : null,
  })),
  Contract: {
    target(contract, _, context) {
      return context.injector.get(TargetManager).getTargetById({
        targetId: contract.targetId,
      });
    },
    viewerCanDisableContract(contract, _, context) {
      return context.injector
        .get(ContractsManager)
        .getViewerCanDisableContractForContract(contract);
    },
  },
  ContractCheck: {
    contractVersion(contractCheck, _, context) {
      return context.injector
        .get(ContractsManager)
        .getContractVersionForContractCheck(contractCheck);
    },
    compositeSchemaSDL: contractCheck => contractCheck.compositeSchemaSdl,
    supergraphSDL: contractCheck => contractCheck.supergraphSdl,
    hasSchemaCompositionErrors(contractCheck, _, { injector }) {
      return injector
        .get(ContractsManager)
        .getHasSchemaCompositionErrorsForContractCheck(contractCheck);
    },
    hasUnapprovedBreakingChanges(contractCheck, _, { injector }) {
      return injector
        .get(ContractsManager)
        .getHasUnapprovedBreakingChangesForContractCheck(contractCheck);
    },
    hasSchemaChanges(contractCheck, _, { injector }) {
      return injector.get(ContractsManager).getHasSchemaChangesForContractCheck(contractCheck);
    },
  },
  ContractVersion: {
    isComposable(contractVersion) {
      return contractVersion.schemaCompositionErrors === null;
    },
    hasSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getHasSchemaChangesForContractVersion(contractVersion);
    },
    breakingSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getBreakingChangesForContractVersion(contractVersion);
    },
    safeSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getSafeChangesForContractVersion(contractVersion);
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
  },
};
