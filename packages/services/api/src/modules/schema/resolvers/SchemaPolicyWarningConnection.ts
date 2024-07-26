import { createDummyConnection } from '../../../shared/schema';
import type { SchemaPolicyWarningConnectionResolvers } from './../../../__generated__/types.next';

// FIXME: eddeee888 this file is in the `externalResolvers` config so it doesn't have static analysis
// Find the right way to type generic for `createDummyConnection` so we don't have to do this
export const SchemaPolicyWarningConnection: SchemaPolicyWarningConnectionResolvers =
  createDummyConnection(warning => ({
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
