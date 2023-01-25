import React from 'react';
import { parse, print } from 'graphql';
import { SchemaEditor, SchemaEditorProps } from '@/components/schema-editor';
import { useColorModeValue } from '@chakra-ui/react';

function prettify(sdl: string) {
  try {
    return print(parse(sdl));
  } catch {
    return sdl;
  }
}

export const GraphQLHighlight: React.FC<
  Omit<SchemaEditorProps, 'schema'> & {
    code: string;
    light?: boolean;
  }
> = ({ code, light, ...props }) => {
  const pretty = React.useMemo(() => prettify(code), [code]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const color = useColorModeValue('rgb(1, 22, 39)', 'gray.200');
  const theme = useColorModeValue('default', 'vs-dark');

  return (
    <SchemaEditor
      theme={light ? theme : 'vs-dark'}
      options={{
        readOnly: true,
      }}
      height="100vh"
      {...props}
      schema={pretty}
    />
  );
};
