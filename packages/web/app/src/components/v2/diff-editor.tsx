import { ReactElement } from 'react';
import { MonacoDiffEditor } from '@/components/schema-editor';
import { Spinner } from '@/components/v2';
import { usePrettify } from '@/lib/hooks';

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
