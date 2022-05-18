import React from 'react';
import { parse, print } from 'graphql';
import tw from 'twin.macro';
import { useColorModeValue } from '@chakra-ui/react';
import { SchemaEditor, SchemaEditorProps } from '@theguild/editor';

const Container = tw.div`rounded-t-lg`;
const Content = tw.div`pb-2 rounded-b-lg`;
const Title = tw.h2`flex flex-row justify-between items-center p-4 text-lg font-medium text-white bg-gray-900 border-b-2 border-gray-800 rounded-t-lg`;

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
      height={'60vh'}
      {...props}
      schema={pretty}
    />
  );
};

export const GraphQLSDLBlock: React.FC<{
  editorProps?: SchemaEditorProps;
  sdl: string;
  title?: string | React.ReactNode;
  url?: string;
}> = ({ editorProps = {}, sdl, title, url }) => {
  return (
    <Container>
      <Title>
        {title ?? 'SDL'}
        {url && <span tw="text-sm italic">{url}</span>}
      </Title>
      <Content>
        <GraphQLHighlight {...editorProps} code={sdl} />
      </Content>
    </Container>
  );
};
