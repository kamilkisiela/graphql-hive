import { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { SchemaEditor, SchemaEditorProps } from '@/components/schema-editor';
import { Card } from '@/components/v2/card';
import { Heading } from '@/components/v2/heading';
import { usePrettify } from '@/lib/hooks';

export function GraphQLHighlight({
  code,
  ...props
}: Omit<SchemaEditorProps, 'schema'> & {
  code: string;
}): ReactElement {
  const pretty = usePrettify(code);

  return (
    <div
      style={{
        height: '60vh',
      }}
    >
      <SchemaEditor
        theme="vs-dark"
        options={{
          readOnly: true,
          lineNumbers: 'on',
        }}
        height="60vh"
        {...props}
        schema={pretty ?? ''}
      />
    </div>
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
        {url && <span className="ml-3 text-sm italic">{url}</span>}
      </Heading>
      <div className="pb-2">
        <GraphQLHighlight {...editorProps} code={sdl} />
      </div>
    </Card>
  );
}
