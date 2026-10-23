import { GraphQLError, parse } from 'graphql/index';
import type { editor } from 'monaco-editor/esm/vs/editor/editor.api';

// Monaco's MarkerSeverity.Error. The enum lives in editor.api, which cannot load under jsdom,
// so the value is inlined to keep this module and its spec free of Monaco.
const ERROR_SEVERITY = 8;

/** Monaco markers for the GraphQL syntax error in `source`, if any. A blank document is fine. */
export function graphqlSyntaxMarkers(source: string): editor.IMarkerData[] {
  if (source.trim() === '') {
    return [];
  }
  try {
    parse(source);
    return [];
  } catch (error) {
    if (!(error instanceof GraphQLError)) {
      throw error;
    }
    const { line, column } = error.locations?.[0] ?? { line: 1, column: 1 };
    return [
      {
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: column + 1,
        message: error.message,
        severity: ERROR_SEVERITY,
      },
    ];
  }
}
