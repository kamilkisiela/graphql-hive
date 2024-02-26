import { ReactElement, useRef, useState } from 'react';
import { MonacoDiffEditor, MonacoEditor } from '@/components/schema-editor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner } from '@/components/v2';
import { usePrettify } from '@/lib/hooks';
import type { Monaco, MonacoDiffEditor as OriginalMonacoDiffEditor } from '@monaco-editor/react';
import { ArrowDownIcon, ArrowUpIcon, DownloadIcon } from '@radix-ui/react-icons';

export const DiffEditor = (props: {
  before: string | null;
  after: string | null;
  downloadFileName?: string;
}): ReactElement => {
  const [showDiff, setShowDiff] = useState<boolean>(true);
  const sdlBefore = usePrettify(props.before);
  const sdlAfter = usePrettify(props.after);
  const editorRef = useRef<OriginalMonacoDiffEditor | null>(null);

  function handleEditorDidMount(editor: OriginalMonacoDiffEditor, monaco: Monaco) {
    addKeyBindings(editor, monaco);
    editorRef.current = editor;
  }

  function addKeyBindings(editor: OriginalMonacoDiffEditor, monaco: Monaco) {
    editor.addCommand(monaco.KeyMod.CtrlCmd + monaco.KeyCode.UpArrow, () => {
      editorRef.current?.goToDiff('previous');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd + monaco.KeyCode.DownArrow, () => {
      editorRef.current?.goToDiff('next');
    });
  }

  return (
    <div className="w-full">
      <div className="border-muted mb-2 flex items-center justify-between border-b px-2 py-1">
        <div className="px-2 font-bold">Diff View</div>
        <div className="ml-auto flex h-[36px] items-center px-2">
          {sdlAfter && props.downloadFileName && (
            <DownloadButton fileName={props.downloadFileName} contents={sdlAfter} />
          )}
          {showDiff && (
            <>
              <div className="mr-2 text-xs font-normal">Navigate changes </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => editorRef.current?.goToDiff('previous')}
                    >
                      <ArrowUpIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous change</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => editorRef.current?.goToDiff('next')}
                    >
                      <ArrowDownIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next change</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <div className="ml-2 flex items-center space-x-2">
            <Label htmlFor="toggle-diff-mode" className="text-xs font-normal">
              Toggle Diff
            </Label>
            <Switch
              id="toggle-diff-mode"
              checked={showDiff}
              onCheckedChange={isChecked => setShowDiff(isChecked)}
            />
          </div>
        </div>
      </div>
      {showDiff ? (
        <MonacoDiffEditor
          width="100%"
          height="70vh"
          language="graphql"
          theme="vs-dark"
          loading={<Spinner />}
          original={sdlBefore ?? undefined}
          modified={sdlAfter ?? undefined}
          options={{
            originalEditable: false,
            renderLineHighlightOnlyWhenFocus: true,
            readOnly: true,
            diffAlgorithm: 'advanced',
            lineNumbers: 'off',
          }}
          onMount={handleEditorDidMount}
        />
      ) : (
        <MonacoEditor
          width="100%"
          height="70vh"
          language="graphql"
          theme="vs-dark"
          loading={<Spinner />}
          value={sdlAfter ?? undefined}
          options={{
            renderLineHighlightOnlyWhenFocus: true,
            readOnly: true,
            lineNumbers: 'off',
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

function DownloadButton(props: { contents: string; fileName: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="sm"
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
            className="mr-2 text-xs font-normal"
          >
            <DownloadIcon className="mr-2" /> Download
          </Button>
        </TooltipTrigger>
        <TooltipContent>Download {props.fileName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
