import 'regenerator-runtime/runtime';
import Document, { Html, Head, Main, NextScript } from 'next/document';
import { extractCritical } from '@emotion/server';

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const page = await ctx.renderPage();
    const styles = extractCritical(page.html);
    return { ...initialProps, ...page, ...styles };
  }

  render() {
    return (
      <Html>
        <Head>
          <style
            data-emotion-css={(this.props as any).ids.join(' ')}
            dangerouslySetInnerHTML={{
              __html: `
                ${(this.props as any).css}
                *:active, *:focus {
                  outline: none !important;
                }
              `,
            }}
          />
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link
            href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap"
            rel="stylesheet"
          />
          <link
            href="https://fonts.googleapis.com/css?family=Poppins:300,400,500,600,700,800&display=swap"
            rel="stylesheet"
          />
          <link rel="shortcut icon" href="/just-logo.svg" />
          <script async src="https://cdn.headwayapp.co/widget.js" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
              if (window.location.pathname.startsWith('/v2')) localStorage['chakra-ui-color-mode'] = 'dark'
              if (localStorage['chakra-ui-color-mode'] === 'dark') {
                document.documentElement.classList.add('dark')
              } else {
                document.documentElement.classList.remove('dark')
              }`,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
