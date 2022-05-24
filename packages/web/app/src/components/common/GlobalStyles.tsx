import { ReactElement } from 'react';
import tw, { GlobalStyles } from 'twin.macro';
import { Global, css } from '@emotion/react';

const customStyles = css`
  html,
  body,
  #__next {
    ${tw`w-screen h-screen`}
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;
  }

  #__next {
    ${tw`flex flex-col h-full text-sm antialiased text-gray-700 lg:text-base`}
  }
`;

export default function GlobalStylesComponent(): ReactElement {
  return (
    <>
      <GlobalStyles />
      <Global styles={customStyles} />
    </>
  );
}
