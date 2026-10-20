import { ContractsManager } from '../providers/contracts-manager';
import { SchemaCheckManager } from '../providers/schema-check-manager';
import { SchemaManager } from '../providers/schema-manager';
import type { FailedSchemaCheckResolvers } from './../../../__generated__/types';

export const FailedSchemaCheck: FailedSchemaCheckResolvers = {
  schemaVersion: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
  },
  safeSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
  },
  breakingSchemaChanges: (schemaCheck, args, { injector }) => {
    return injector.get(SchemaCheckManager).getBreakingSchemaChangesPage(schemaCheck, args);
  },
  compositionErrors: schemaCheck => {
    return schemaCheck.schemaCompositionErrors;
  },
  hasSchemaCompositionErrors: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
  },
  hasSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
  },
  hasUnapprovedBreakingChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getHasUnapprovedBreakingChanges(schemaCheck);
  },
  webUrl: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaManager).getSchemaCheckWebUrl({
      schemaCheckId: schemaCheck.id,
      targetId: schemaCheck.targetId,
    });
  },
  canBeApproved: async (schemaCheck, _, { injector }) => {
    return injector.get(SchemaManager).getFailedSchemaCheckCanBeApproved(schemaCheck);
  },
  canBeApprovedByViewer: async (schemaCheck, _, { injector }) => {
    return injector.get(SchemaManager).getFailedSchemaCheckCanBeApprovedByViewer(schemaCheck);
  },
  contractChecks: (schemaCheck, _, { injector }) => {
    return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
  },
  previousSchemaSDL: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
  },
  conditionalBreakingChangeMetadata: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
  },
  schemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getAllSchemaChanges(schemaCheck);
  },
  baseline: async (schemaCheck, _arg, { injector }) => {
    return injector.get(SchemaCheckManager).getGraphQLSchemaCheckBaseline(schemaCheck);
  },
  contractCheck: (schemaCheck, args, { injector }) => {
    return injector.get(ContractsManager).getContractCheckForSchemaCheck(schemaCheck, args.id);
  },
  safeSchemaChangeGroups: (schemaCheck, args, { injector }) => {
    return injector.get(SchemaCheckManager).getSafeSchemaChangeGroups(schemaCheck, args.kind);
  },
  unapprovedBreakingSchemaChangeCount: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getUnapprovedBreakingSchemaChangeCount(schemaCheck);
  },
};
