import Document, { Html, Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;
    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(<App {...props} />),
        });
      const initialProps = await Document.getInitialProps(ctx);

      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      };
    } finally {
      sheet.seal();
    }
  }

  render() {
    const richData = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'GraphQL Hive',
      url: 'https://graphql-hive.com',
      email: 'contact@the-guild.dev',
      logo: 'https://graphql-hive.com/logo.svg',
    };

    return (
      <Html>
        <Head>
          {GA_TRACKING_ID && (
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
            />
          )}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(richData) }}
          />
          {GA_TRACKING_ID && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_TRACKING_ID}', {
                page_path: window.location.pathname,
              });
              `,
              }}
            />
          )}
          {CRISP_WEBSITE_ID && (
            <script
              async
              defer
              dangerouslySetInnerHTML={{
                __html: `
            if (typeof window !== 'undefined') {
              window.$crisp = [];
              window.CRISP_WEBSITE_ID = '${CRISP_WEBSITE_ID}';
              (function () {
                d = document;
                s = d.createElement('script');
                s.src = 'https://client.crisp.chat/l.js';
                s.async = 1;
                d.getElementsByTagName('head')[0].appendChild(s);
              })();
            
              window.$crisp.push(['set', 'session:segments', [['hive-website']]]);
            }            
            `,
              }}
            />
          )}
          <link rel="shortcut icon" href="/just-logo.svg" />
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link
            href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/apple-touch-icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <link rel="manifest" href="/site.webmanifest" />
          <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#eab308" />
          <meta name="msapplication-TileColor" content="#eab308" />
          <meta name="theme-color" content="#ffffff"></meta>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
