import { createDummyConnection } from '../../../shared/schema';
import { SchemaCheckWarning } from '../providers/models/shared';
import type { SchemaPolicyWarningConnectionResolvers } from './../../../__generated__/types.next';

const connection = createDummyConnection<SchemaCheckWarning>(warning => ({
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
}));

export const SchemaPolicyWarningConnection: SchemaPolicyWarningConnectionResolvers = {
  edges: connection.edges,
  pageInfo: connection.pageInfo,
};
