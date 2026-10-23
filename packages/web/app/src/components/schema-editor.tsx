// Import from `editor.api` rather than the `monaco-editor` main entry to keep
// the bundle lean — the main entry auto-registers every basic language, which
// bloats our client sourcemaps. We opt in to the contributions we actually use
// via the side-effect imports below.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// Enables the read-only tooltip shown when users type into a read-only model.
import 'monaco-editor/esm/vs/editor/contrib/readOnlyMessage/browser/contribution.js';
// Registers the basic GraphQL Monarch tokenizer so `language="graphql"` models
// get syntax highlighting. Without this, `editor.api` ships no languages.
import 'monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution.js';
// Registers the JSON language service (`monaco.languages.json`) — required by
// the policy naming-convention rule editor, which configures JSON schema
// diagnostics in `beforeMount`.
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import { useRef } from 'react';
import { useMonacoTheme } from '@/components/theme/theme-provider';
import { graphqlSyntaxMarkers } from '@/lib/graphql-syntax-markers';
import {
  loader,
  DiffEditor as MonacoDiffEditor,
  Editor as MonacoEditor,
  type EditorProps,
  type OnMount,
} from '@monaco-editor/react';

// Use the locally bundled Monaco (via vite-plugin-monaco-editor) instead of CDN
// to ensure the editor and workers are from the same version.
loader.config({ monaco });

export { MonacoDiffEditor };
export { MonacoEditor };

export type SchemaEditorProps = Omit<EditorProps, 'language'> & {
  /** Underlines GraphQL syntax errors in the editor and reports them, on mount and after every edit. */
  onSyntaxErrors?: (markers: monaco.editor.IMarkerData[]) => void;
};

/** Monaco with the GraphQL tokenizer. Defaults to the app theme; passing `theme` explicitly still wins. */
export function SchemaEditor({ onSyntaxErrors, onMount, ...props }: SchemaEditorProps) {
  const monacoTheme = useMonacoTheme();
  // The Monaco wrapper reads `onMount` once, at first render; refs keep the latest callbacks reachable.
  const onSyntaxErrorsRef = useRef(onSyntaxErrors);
  onSyntaxErrorsRef.current = onSyntaxErrors;
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  const handleMount: OnMount = (editor, monacoInstance) => {
    if (onSyntaxErrorsRef.current) {
      const markSyntaxErrors = () => {
        const model = editor.getModel();
        if (!model) {
          return;
        }
        const markers = graphqlSyntaxMarkers(model.getValue());
        monacoInstance.editor.setModelMarkers(model, 'graphql', markers);
        onSyntaxErrorsRef.current?.(markers);
      };
      markSyntaxErrors();
      // The wrapper's `onChange` skips the edits it makes itself for a new `value`; the model event does not.
      const subscription = editor.onDidChangeModelContent(markSyntaxErrors);
      editor.onDidDispose(() => subscription.dispose());
    }
    onMountRef.current?.(editor, monacoInstance);
  };

  return <MonacoEditor theme={monacoTheme} {...props} language="graphql" onMount={handleMount} />;
}
