import { ReactElement } from 'react';
import { Spinner } from '@/components/v2';
import { usePrettify } from '@/lib/hooks';
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';

export const DiffEditor = ({ before, after }: { before: string; after: string }): ReactElement => {
  const sdlBefore = usePrettify(before);
  const sdlAfter = usePrettify(after);

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
