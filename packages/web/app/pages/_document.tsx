import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document';
import 'regenerator-runtime/runtime';

export default class MyDocument extends Document<{
  ids: Array<string>;
  css: string;
}> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    const page = await ctx.renderPage();

    return {
      ...initialProps,
      ...page,
    };
  }

  render() {
    return (
      <Html className="dark">
        <Head>
          <style
            dangerouslySetInnerHTML={{
              __html:
                // we setup background via style tag to prevent white flash on initial page loading
                'html {background: #030711}',
            }}
          />
          <link rel="preconnect" href="https://rsms.me/" />
          <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
          <link rel="icon" href="/just-logo.svg" type="image/svg+xml" />
          {/* eslint-disable-next-line @next/next/no-sync-scripts -- if it's not sync, then env variables are not present) */}
          <script src="/__ENV.js" />
        </Head>
        <body className="bg-transparent font-sans text-white">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
