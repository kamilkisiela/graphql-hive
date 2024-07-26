import { ContractsManager } from '../providers/contracts-manager';
import { SchemaCheckManager } from '../providers/schema-check-manager';
import { SchemaManager } from '../providers/schema-manager';
import type { SuccessfulSchemaCheckResolvers } from './../../../__generated__/types.next';

export const SuccessfulSchemaCheck: SuccessfulSchemaCheckResolvers = {
  schemaVersion: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
  },
  safeSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
  },
  breakingSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
  },
  hasSchemaCompositionErrors: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
  },
  hasSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
  },
  hasUnapprovedBreakingChanges: () => {
    return false;
  },
  webUrl: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaManager).getSchemaCheckWebUrl({
      schemaCheckId: schemaCheck.id,
      targetId: schemaCheck.targetId,
    });
  },
  isApproved: schemaCheck => {
    return schemaCheck.isManuallyApproved;
  },
  approvedBy: (schemaCheck, _, { injector }) => {
    return schemaCheck.isManuallyApproved
      ? injector.get(SchemaManager).getApprovedByUser({
          organizationId: schemaCheck.selector.organizationId,
          userId: schemaCheck.manualApprovalUserId,
        })
      : null;
  },
  approvalComment: schemaCheck => {
    return schemaCheck.isManuallyApproved ? schemaCheck.manualApprovalComment : null;
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
