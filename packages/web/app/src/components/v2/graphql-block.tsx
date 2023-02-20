import { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { SchemaEditor, SchemaEditorProps } from '@/components/schema-editor';
import { Card } from '@/components/v2/card';
import { Heading } from '@/components/v2/heading';
import { usePrettify } from '@/lib/hooks';

function GraphQLHighlight({
  code,
  ...props
}: Omit<SchemaEditorProps, 'schema'> & {
  code: string;
}): ReactElement {
  const pretty = usePrettify(code);

  return (
    <SchemaEditor
      theme="vs-dark"
      options={{
        readOnly: true,
        lineNumbers: 'off',
      }}
      height="60vh"
      {...props}
      schema={pretty}
    />
  );
}

export function GraphQLBlock({
  editorProps = {},
  sdl,
  title,
  url,
  className,
}: {
  editorProps?: SchemaEditorProps;
  sdl: string;
  title?: string | ReactNode;
  url?: string;
  className?: string;
}): ReactElement {
  return (
    <Card className={clsx(className)}>
      <Heading className="mb-4">
        {title ?? 'SDL'}
        {url && <span className="text-sm italic ml-3">{url}</span>}
      </Heading>
      <div className="pb-2">
        <GraphQLHighlight {...editorProps} code={sdl} />
      </div>
    </Card>
  );
}
