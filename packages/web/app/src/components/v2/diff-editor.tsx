import { ReactElement, useMemo } from 'react';
import { parse, print } from 'graphql';
import { Spinner } from '@/components/common/Spinner';
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';

const prettify = (sdl: string): string => {
  if (!sdl) {
    return '';
  }

  try {
    return print(parse(sdl));
  } catch {
    return sdl;
  }
};

export const DiffEditor = ({ before, after }: { before: string; after: string }): ReactElement => {
  const sdlBefore = useMemo(() => prettify(before), [before]);
  const sdlAfter = useMemo(() => prettify(after), [after]);

  return (
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
        readOnly: true,
        lineNumbers: 'off',
      }}
    />
  );
};
