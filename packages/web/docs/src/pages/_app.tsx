import { ReactElement } from 'react';
import { AppProps } from 'next/app';
import '@theguild/components/style.css';
import localFont from 'next/font/local';
import '../components/navigation-menu/navbar-global-styles.css';
import '../selection-styles.css';

const neueMontreal = localFont({
  // TODO: Swap to variable version.
  // TODO: We only use 400 and 500 weights, right?
  src: [
    { path: '../fonts/NeueMontreal-Light.otf', weight: '300' },
    { path: '../fonts/NeueMontreal-Light.otf', style: 'italic' },
    { path: '../fonts/NeueMontreal-Regular.otf', weight: '400' },
    { path: '../fonts/NeueMontreal-Italic.otf', weight: '400', style: 'italic' },
    { path: '../fonts/NeueMontreal-Medium.otf', weight: '500' },
    { path: '../fonts/NeueMontreal-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../fonts/NeueMontreal-Bold.otf', weight: '700' },
    { path: '../fonts/NeueMontreal-BoldItalic.otf', weight: '700', style: 'italic' },
  ],
});

export default function App({ Component, pageProps }: AppProps): ReactElement {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-sans: ${neueMontreal.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
