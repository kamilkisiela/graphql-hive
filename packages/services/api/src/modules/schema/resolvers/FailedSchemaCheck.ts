import { ContractsManager } from '../providers/contracts-manager';
import { SchemaCheckManager } from '../providers/schema-check-manager';
import { SchemaManager } from '../providers/schema-manager';
import type { FailedSchemaCheckResolvers } from './../../../__generated__/types.next';

export const FailedSchemaCheck: FailedSchemaCheckResolvers = {
  schemaVersion: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
  },
  safeSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
  },
  breakingSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
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
  schemaPolicyErrors: ({ schemaPolicyErrors }, _arg, _ctx) => {
    // FIXME: @eddeee888 check why this doesn't have runtime error
    return schemaPolicyErrors as any;
  },
  schemaPolicyWarnings: ({ schemaPolicyWarnings }, _arg, _ctx) => {
    // FIXME: @eddeee888 check why this doesn't have runtime error
    return schemaPolicyWarnings as any;
  },
};
