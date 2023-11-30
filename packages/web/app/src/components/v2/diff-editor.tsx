import { ReactElement, useRef } from 'react';
import { cx } from 'class-variance-authority';
import { MonacoDiffEditor } from '@/components/schema-editor';
import { Button, Spinner, Tooltip } from '@/components/v2';
import { usePrettify } from '@/lib/hooks';
import type { Monaco, MonacoDiffEditor as OriginalMonacoDiffEditor } from '@monaco-editor/react';
import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';

export const DiffEditor = ({
  title,
  before,
  after,
  className = '',
}: {
  before: string;
  after: string;
  title?: string;
  className?: string;
}): ReactElement => {
  const sdlBefore = usePrettify(before);
  const sdlAfter = usePrettify(after);
  const diffNavigator = useRef<ReturnType<Monaco['editor']['createDiffNavigator']>>(null);
  const editorRef = useRef<OriginalMonacoDiffEditor>(null);
  const afterRef = useRef<string>(after);

  // Bug: https://github.com/microsoft/monaco-editor/issues/3920
  // It's a super awkward fix to scroll to the top of the editor when the `after` prop changes and before the DiffEditor receives the new value.
  // I could do it in useEffects but it would be a bit too late and the exception would be thrown.
  if (afterRef.current !== after) {
    afterRef.current = after;
    editorRef.current?.revealLine(1);
  }

  function handleEditorDidMount(editor: OriginalMonacoDiffEditor, monaco: Monaco) {
    addKeyBindings(editor, monaco);
    // @ts-expect-error it says read-only but it's not
    diffNavigator.current = monaco.editor.createDiffNavigator(editor, {
      followsCaret: true, // resets the navigator state when the user selects something in the editor
      ignoreCharChanges: true, // jump from line to line
    });
    // @ts-expect-error it says read-only but it's not
    editorRef.current = editor;
  }

  function addKeyBindings(editor: OriginalMonacoDiffEditor, monaco: Monaco) {
    editor.addCommand(monaco.KeyMod.CtrlCmd + monaco.KeyCode.UpArrow, () => {
      diffNavigator.current?.previous();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd + monaco.KeyCode.DownArrow, () => {
      diffNavigator.current?.next();
    });
  }

  return (
    <div className={cx('h-full w-full', className)}>
      <div className="flex items-center justify-between p-5">
        {title && <div className="font-semibold">{title}</div>}
        <div className="flex items-center">
          <div className="mr-2 text-xs font-normal">Navigate changes</div>
          <Tooltip content="Previous change">
            <Button onClick={() => diffNavigator.current?.previous()}>
              <ArrowUpIcon />
            </Button>
          </Tooltip>

          <Tooltip content="Next change">
            <Button onClick={() => diffNavigator.current?.next()}>
              <ArrowDownIcon />
            </Button>
          </Tooltip>
        </div>
      </div>
      <MonacoDiffEditor
        width="100%"
        height="100%"
        language="graphql"
        theme="vs-dark"
        loading={<Spinner />}
        original={sdlBefore}
        modified={sdlAfter}
        options={{
          originalEditable: false,
          renderLineHighlightOnlyWhenFocus: true,
          readOnly: true,
          diffAlgorithm: 'advanced',
          lineNumbers: 'off',
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
};
