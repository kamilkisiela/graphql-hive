import 'regenerator-runtime/runtime';
import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';
import { extractCritical } from '@emotion/server';

type FrontendEnvironment = {
  APP_BASE_URL: string | undefined;
  DOCS_URL: string | undefined;
  STRIPE_PUBLIC_KEY: string | undefined;
  AUTH_GITHUB: string | undefined;
  AUTH_GOOGLE: string | undefined;
  MIXPANEL_TOKEN: string | undefined;
  GA_TRACKING_ID: string | undefined;
  CRISP_WEBSITE_ID: string | undefined;
  SENTRY_DSN: string | undefined;
  RELEASE: string | undefined;
  ENVIRONMENT: string | undefined;
  SENTRY_ENABLED: string | undefined;
};

export default class MyDocument extends Document<{ ids: Array<string>; css: string; __ENV__: FrontendEnvironment }> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    const page = await ctx.renderPage();
    const styles = extractCritical(page.html);

    const __ENV__: FrontendEnvironment = {
      APP_BASE_URL: process.env['APP_BASE_URL'],
      DOCS_URL: process.env['DOCS_URL'],
      STRIPE_PUBLIC_KEY: process.env['STRIPE_PUBLIC_KEY'],
      AUTH_GITHUB: process.env['AUTH_GITHUB'],
      AUTH_GOOGLE: process.env['AUTH_GOOGLE'],
      MIXPANEL_TOKEN: process.env['MIXPANEL_TOKEN'],
      GA_TRACKING_ID: process.env['GA_TRACKING_ID'],
      CRISP_WEBSITE_ID: process.env['CRISP_WEBSITE_ID'],
      SENTRY_DSN: process.env['SENTRY_DSN'],
      RELEASE: process.env['RELEASE'],
      ENVIRONMENT: process.env['ENVIRONMENT'],
      SENTRY_ENABLED: process.env['SENTRY_ENABLED'],
    };

    return {
      ...initialProps,
      ...page,
      ...styles,
      __ENV__,
    };
  }

  render() {
    const { ids, css } = this.props;

    return (
      <Html className="dark">
        <Head>
          <style
            data-emotion-css={ids.join(' ')}
            dangerouslySetInnerHTML={{
              __html:
                css +
                // we setup background via style tag to prevent white flash on initial page loading
                `html {background: #0b0d11}`,
            }}
          />
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap"
            rel="stylesheet"
          />
          <link rel="shortcut icon" href="/just-logo.svg" />
          <script async src="https://cdn.headwayapp.co/widget.js" />
          <script
            id="force-dark-mode"
            dangerouslySetInnerHTML={{ __html: "localStorage['chakra-ui-color-mode'] = 'dark';" }}
          />
          <script
            type="module"
            dangerouslySetInnerHTML={{
              __html: `globalThis["__ENV__"] = ${JSON.stringify((this.props as any).__ENV__)}`,
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
