import tw, { GlobalStyles } from 'twin.macro';
import { Global, css } from '@emotion/react';

const customStyles = css`
  html,
  body,
  #__next {
    ${tw`w-screen h-screen overflow-y-auto`}
    font-family: 'Lato', sans-serif;
  }

  #__next {
    ${tw`flex flex-col h-full text-sm antialiased text-gray-700 lg:text-base`}
  }
`;

export default function GlobalStylesComponent() {
  return (
    <>
      <GlobalStyles />
      <Global styles={customStyles} />
    </>
  );
}
