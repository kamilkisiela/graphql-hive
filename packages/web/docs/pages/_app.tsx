import 'nextra-theme-docs/style.css';
import React from 'react';
import { AppProps } from 'next/app';
import Script from 'next/script';
import { useRouter } from 'next/router';
import * as gtag from '../src/gtag';

// eslint-disable-next-line no-process-env
const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

export default function Nextra({ Component, pageProps }: AppProps) {
  const router = useRouter();
  React.useEffect(() => {
    const handleRouteChange = url => {
      gtag.pageview(url);
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    router.events.on('hashChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      router.events.off('hashChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      {gtag.GA_TRACKING_ID && (
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${gtag.GA_TRACKING_ID}`}
        />
      )}
      {gtag.GA_TRACKING_ID && (
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gtag.GA_TRACKING_ID}', {
              page_path: window.location.pathname,
            });
          `,
          }}
        />
      )}
      {CRISP_WEBSITE_ID && (
        <Script
          id="crisp-init"
          strategy="afterInteractive"
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
                
                  window.$crisp.push(['set', 'session:segments', [['hive-docs']]]);
                }
              `,
          }}
        />
      )}
      <Component {...pageProps} />
    </>
  );
}
