import { ReactElement } from 'react';
import { css, Global } from '@emotion/react';
import tw, { GlobalStyles } from 'twin.macro';

const customStyles = css`
  *:active,
  *:focus {
    outline: none !important;
  }

  html,
  body,
  #__next {
    ${tw`w-screen h-screen`}
  }

  #__next {
    font-family: inherit !important;
    color: inherit !important;
    ${tw`flex flex-col h-full text-sm antialiased text-gray-700 lg:text-base`}
  }

  // Remove autocomplete color in Chrome
  input:-webkit-autofill {
    &,
    &:hover,
    &:focus,
    &:active {
      -webkit-transition: color 9999s ease-out, background-color 9999s ease-out;
      -webkit-transition-delay: 9999s;
    }
  }

  select {
    // remove default arrow down icon in right side
    appearance: none;
  }

  .monaco-editor,
  .monaco-editor-background,
  [role='presentation'] {
    background: transparent !important;
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
