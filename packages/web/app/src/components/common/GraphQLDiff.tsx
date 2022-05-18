import React from 'react';
import { parse, print } from 'graphql';
import { DiffEditor as MonacoDiffEditor, Monaco } from '@monaco-editor/react';
import theme from 'monaco-themes/themes/Night Owl.json';
import { Spinner } from './Spinner';

function prettify(sdl: string) {
  return sdl ? print(parse(sdl)) : '';
}

export const GraphQLDiff: React.FC<{
  before: string;
  after: string;
  height: number;
}> = ({ before, after, height }) => {
  const sdlBefore = React.useMemo(() => prettify(before), [before]);
  const sdlAfter = React.useMemo(() => prettify(after), [after]);
  const beforeMount = React.useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme('night-owl', theme as any);
  }, []);

  return (
    <MonacoDiffEditor
      width="100%"
      height={height}
      language="graphql"
      theme="night-owl"
      beforeMount={beforeMount}
      loading={<Spinner />}
      original={sdlBefore}
      modified={sdlAfter}
      options={{
        originalEditable: false,
        readOnly: true,
        lineNumbers: 'off',
      }}
    />
  );
};
