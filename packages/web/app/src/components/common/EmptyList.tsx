import React from 'react';
import tw, { styled } from 'twin.macro';
import { Button } from '@chakra-ui/react';

const Container = styled.div(({ space }: { space?: boolean }) => [
  tw`
    flex flex-row items-center 
    p-3
    rounded-xl
    bg-gradient-to-l from-yellow-50 to-yellow-100`,
  space ? tw`my-6 mx-3` : ``,
]);

export const EmptyList: React.FC<{
  title: string;
  description: string;
  documentationLink: string;
  space?: boolean;
}> = ({ title, description, documentationLink, space }) => {
  return (
    <Container space={space}>
      <img src="/magnifier.svg" tw="w-28 h-28" />
      <div tw="pl-3">
        <h2 tw="text-gray-900 text-lg font-medium">{title}</h2>
        <p tw="leading-relaxed text-sm dark:text-gray-600">{description}</p>
        <div tw="pt-3">
          <Button
            as="a"
            size="sm"
            href={documentationLink}
            colorScheme="primary"
          >
            Read about it in the documentation
          </Button>
        </div>
      </div>
    </Container>
  );
};
