import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document';
import 'regenerator-runtime/runtime';
// don't remove this import ; it will break the built app ; but not the dev app :)
import '@/config/frontend-env';

export default class MyDocument extends Document<{
  ids: Array<string>;
  css: string;
  frontendEnv: typeof import('@/config/frontend-env')['env'];
}> {
  static async getInitialProps(ctx: DocumentContext) {
    const { env: frontendEnv } = await import('@/config/frontend-env');
    const initialProps = await Document.getInitialProps(ctx);
    const page = await ctx.renderPage();

    return {
      ...initialProps,
      ...page,
      frontendEnv,
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
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          {/* <link
            href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
            rel="stylesheet"
          /> */}
          <link rel="icon" href="/just-logo.svg" type="image/svg+xml" />
          <script
            type="module"
            dangerouslySetInnerHTML={{
              __html: `globalThis.__frontend_env = ${JSON.stringify(
                (this.props as any).frontendEnv,
              )}`,
            }}
          />
        </Head>
        <body className="bg-transparent font-sans text-white">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
