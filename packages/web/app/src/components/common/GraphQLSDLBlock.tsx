import { ReactElement } from 'react';
import { SchemaEditor, SchemaEditorProps } from '@/components/schema-editor';
import { usePrettify } from '@/lib/hooks';

export function GraphQLHighlight({
  code,
  options,
  ...props
}: Omit<SchemaEditorProps, 'schema'> & {
  code: string;
}): ReactElement {
  const pretty = usePrettify(code);
  return (
    <SchemaEditor
      options={{ readOnly: true, ...options }}
      height="100vh"
      {...props}
      schema={pretty ?? ''}
    />
  );
}
