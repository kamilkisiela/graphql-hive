import { parseCliAuthor } from '../lib/parse-cli-author';
import { ContractsManager } from '../providers/contracts-manager';
import { SchemaCheckManager } from '../providers/schema-check-manager';
import { SchemaManager } from '../providers/schema-manager';
import type { SuccessfulSchemaCheckResolvers } from './../../../__generated__/types';

export const SuccessfulSchemaCheck: SuccessfulSchemaCheckResolvers = {
  schemaVersion: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
  },
  safeSchemaChanges: (schemaCheck, _, { injector }) => {
    return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
  },
  breakingSchemaChanges: (schemaCheck, args, { injector }) => {
    return injector.get(SchemaCheckManager).getBreakingSchemaChangesPage(schemaCheck, args);
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
  cliApprovalMetadata: schemaCheck => {
    if (!schemaCheck.isManuallyApproved || schemaCheck.manualApprovalUserId) {
      return null;
    }
    if (schemaCheck.breakingSchemaChanges) {
      for (const change of schemaCheck.breakingSchemaChanges) {
        if (change.approvalMetadata?.author) {
          const { displayName, email } = parseCliAuthor(change.approvalMetadata.author);
          return {
            author: change.approvalMetadata.author,
            displayName,
            email,
          } as const;
        }
      }
    }
    return null;
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
  // Matches hasUnapprovedBreakingChanges: a successful check has none left to approve.
  unapprovedBreakingSchemaChangeCount: () => {
    return 0;
  },
};
