import { ReactElement, ReactNode } from 'react';
import { SchemaEditor, SchemaEditorProps } from '@/components/schema-editor';
import { Card } from '@/components/ui/primitives/card/card';
import { usePrettify } from '@/lib/hooks';
import { Heading } from './heading';

export function GraphQLHighlight({
  code,
  options,
  ...props
}: SchemaEditorProps & {
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
        options={{ readOnly: true, lineNumbers: 'on', ...options }}
        height="60vh"
        {...props}
        value={pretty ?? ''}
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
    <div className={className}>
      <Card variants={{ onSurface: 'base' }}>
        <Heading className="mb-4">
          {title ?? 'SDL'}
          {url && <span className="ml-3 text-sm italic">{url}</span>}
        </Heading>
        <div className="pb-2">
          <GraphQLHighlight {...editorProps} code={sdl} />
        </div>
      </Card>
    </div>
  );
}
