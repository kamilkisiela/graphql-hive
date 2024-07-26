import { createDummyConnection } from '../../shared/schema';
import { TargetManager } from '../target/providers/target-manager';
import type { SchemaModule } from './__generated__/types';
import { ContractsManager } from './providers/contracts-manager';
import { SchemaCheckManager } from './providers/schema-check-manager';
import { SchemaManager } from './providers/schema-manager';

export const resolvers: SchemaModule.Resolvers = {
  SuccessfulSchemaCheck: {
    schemaVersion(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
    },
    safeSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
    },
    breakingSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
    },
    hasSchemaCompositionErrors(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
    },
    hasSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
    },
    hasUnapprovedBreakingChanges() {
      return false;
    },
    webUrl(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getSchemaCheckWebUrl({
        schemaCheckId: schemaCheck.id,
        targetId: schemaCheck.targetId,
      });
    },
    isApproved(schemaCheck) {
      return schemaCheck.isManuallyApproved;
    },
    approvedBy(schemaCheck, _, { injector }) {
      return schemaCheck.isManuallyApproved
        ? injector.get(SchemaManager).getApprovedByUser({
            organizationId: schemaCheck.selector.organizationId,
            userId: schemaCheck.manualApprovalUserId,
          })
        : null;
    },
    approvalComment(schemaCheck) {
      return schemaCheck.isManuallyApproved ? schemaCheck.manualApprovalComment : null;
    },
    contractChecks(schemaCheck, _, { injector }) {
      return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
    },
    previousSchemaSDL(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
    },
    conditionalBreakingChangeMetadata(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
    },
  },
  FailedSchemaCheck: {
    schemaVersion(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
    },
    safeSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
    },
    breakingSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
    },
    compositionErrors(schemaCheck) {
      return schemaCheck.schemaCompositionErrors;
    },
    hasSchemaCompositionErrors(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
    },
    hasSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
    },
    hasUnapprovedBreakingChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasUnapprovedBreakingChanges(schemaCheck);
    },
    webUrl(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getSchemaCheckWebUrl({
        schemaCheckId: schemaCheck.id,
        targetId: schemaCheck.targetId,
      });
    },
    async canBeApproved(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getFailedSchemaCheckCanBeApproved(schemaCheck);
    },
    async canBeApprovedByViewer(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getFailedSchemaCheckCanBeApprovedByViewer(schemaCheck);
    },
    contractChecks(schemaCheck, _, { injector }) {
      return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
    },
    previousSchemaSDL(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
    },
    conditionalBreakingChangeMetadata(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
    },
  },
  BreakingChangeMetadataTarget: {
    target(record, _, { injector }) {
      return injector
        .get(TargetManager)
        .getTargetById({ targetId: record.id })
        .catch(() => null);
    },
  },
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
