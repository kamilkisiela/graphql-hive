import { ReactElement, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import { editor } from 'monaco-editor/esm/vs/editor/editor.api';
import { MonacoDiffEditor, MonacoEditor } from '@/components/schema-editor';
import { useMonacoTheme } from '@/components/theme/theme-provider';
import { Button } from '@/components/ui/primitives/button/button';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { Label } from '@/components/ui/primitives/label/label';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { Switch } from '@/components/ui/primitives/switch/switch';
import type { Monaco, MonacoDiffEditor as OriginalMonacoDiffEditor } from '@monaco-editor/react';
import * as styles from './diff-editor.css';

export const DiffEditor = (props: {
  title?: ReactElement;
  before: string | null;
  after: string | null;
  downloadFileName?: string;
  /** Allow editing the after schema. Editable schemas don't allow toggling between diff and no-diff */
  editable?: boolean;
  lineNumbers?: boolean;
  onMount?: (editor: editor.IStandaloneCodeEditor) => void;
  onChange?: (source: string | undefined) => void;
}): ReactElement => {
  const monacoTheme = useMonacoTheme();
  const [showDiff, setShowDiff] = useState<boolean>(true);
  const editorRef = useRef<OriginalMonacoDiffEditor | null>(null);
  const modelsRef = useRef<{
    original: editor.ITextModel | null;
    modified: editor.ITextModel | null;
  }>({ original: null, modified: null });

  // useLayoutEffect cleanup runs before @monaco-editor/react's useEffect cleanup.
  // This lets us call setModel(null) to detach models from the widget, removing
  // Monaco's onWillDispose listeners that throw "TextModel got disposed before
  // DiffEditorWidget model got reset".
  useLayoutEffect(() => {
    return () => {
      editorRef.current?.setModel(null);
      modelsRef.current.original?.dispose();
      modelsRef.current.modified?.dispose();
      modelsRef.current = { original: null, modified: null };
      editorRef.current = null;
    };
  }, []);

  function handleEditorDidMount(editor: OriginalMonacoDiffEditor, monaco: Monaco) {
    addKeyBindings(editor, monaco);
    editorRef.current = editor;
    modelsRef.current = {
      original: editor.getOriginalEditor().getModel(),
      modified: editor.getModifiedEditor().getModel(),
    };
    props.onMount?.(editor.getModifiedEditor());

    editor.getModifiedEditor().onDidChangeModelContent(() => {
      if (props.editable) {
        const modified = editor.getModifiedEditor();
        props.onChange?.(modified.getValue());
      }
    });
  }

  function addKeyBindings(editor: OriginalMonacoDiffEditor, monaco: Monaco) {
    editor.addCommand(monaco.KeyMod.CtrlCmd + monaco.KeyCode.UpArrow, () => {
      editorRef.current?.goToDiff('previous');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd + monaco.KeyCode.DownArrow, () => {
      editorRef.current?.goToDiff('next');
    });
  }

  const title = props?.title ?? 'Diff View';

  return (
    <div className={styles.diffEditorDiv}>
      <div className={styles.diffEditorDiv2}>
        <div className={styles.diffEditorDiv3}>{title}</div>
        <div className={styles.diffEditorDiv4}>
          {props.after && props.downloadFileName && (
            <DownloadButton fileName={props.downloadFileName} contents={props.after} />
          )}
          {showDiff && (
            <>
              <div className={styles.diffEditorDiv5}>Navigate changes </div>
              <Tooltip
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editorRef.current?.goToDiff('previous')}
                  >
                    <ArrowUp className={styles.diffEditorArrowUp} />
                  </Button>
                }
                content="Previous change"
              />
              <Tooltip
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editorRef.current?.goToDiff('next')}
                  >
                    <ArrowDown className={styles.diffEditorArrowDown} />
                  </Button>
                }
                content="Next change"
              />
            </>
          )}
          {props.editable ? null : (
            <div className={styles.diffEditorDiv6}>
              <Label variant="inline" htmlFor="toggle-diff-mode" label="Toggle Diff" />
              <Switch
                id="toggle-diff-mode"
                checked={showDiff}
                onCheckedChange={isChecked => setShowDiff(isChecked)}
              />
            </div>
          )}
        </div>
      </div>
      {showDiff ? (
        <MonacoDiffEditor
          theme={monacoTheme}
          width="100%"
          height="70vh"
          language="graphql"
          loading={<Spinner />}
          original={props.before ?? undefined}
          modified={props.after ?? undefined}
          keepCurrentOriginalModel
          keepCurrentModifiedModel
          options={{
            originalEditable: false,
            renderLineHighlightOnlyWhenFocus: true,
            readOnly: !props.editable,
            diffAlgorithm: 'advanced',
            lineNumbers: props.lineNumbers ? undefined : 'off',
          }}
          onMount={handleEditorDidMount}
        />
      ) : (
        <MonacoEditor
          theme={monacoTheme}
          width="100%"
          height="70vh"
          language="graphql"
          loading={<Spinner />}
          value={props.after ?? undefined}
          onMount={props.onMount}
          onChange={props.onChange}
          options={{
            renderLineHighlightOnlyWhenFocus: true,
            readOnly: !props.editable,
            lineNumbers: props.lineNumbers ? undefined : 'off',
            minimap: {
              enabled: false,
            },
            folding: false,
          }}
        />
      )}
    </div>
  );
};

export function DownloadButton(props: { contents: string; fileName: string }) {
  return (
    <Tooltip
      trigger={
        <Button
          variant="ghost"
          size="compact"
          onClick={() => {
            const element = document.createElement('a');
            element.setAttribute(
              'href',
              'data:text/plain;charset=utf-8, ' + encodeURIComponent(props.contents),
            );
            element.setAttribute('download', props.fileName);
            document.body.appendChild(element);
            element.click();

            document.body.removeChild(element);
          }}
        >
          <Download className={styles.downloadButtonDownload} /> Download
        </Button>
      }
      content={`Download ${props.fileName}`}
    />
  );
}
