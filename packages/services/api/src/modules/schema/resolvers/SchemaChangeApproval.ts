import { SchemaManager } from '../providers/schema-manager';
import type { SchemaChangeApprovalResolvers } from './../../../__generated__/types.next';

export const SchemaChangeApproval: SchemaChangeApprovalResolvers = {
  approvedBy: (approval, _, { injector }) =>
    injector.get(SchemaManager).getUserForSchemaChangeById({ userId: approval.userId }),
  approvedAt: approval => approval.date,
};
