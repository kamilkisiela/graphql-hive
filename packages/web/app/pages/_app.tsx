import React from 'react';
import type { AppProps } from 'next/app';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { initMixpanel } from '@/lib/mixpanel';
import { Provider as UrqlProvider } from 'urql';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { urqlClient } from '@/lib/urql';
import GlobalStylesComponent from '@/components/common/GlobalStyles';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { NavigationProvider } from '@/components/common/Navigation';
import { Page } from '@/components/common/Page';
import * as gtag from '@/lib/gtag';
import { colors } from '@/lib/theme';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import '@/lib/graphiql.css';
import { HiveStripeWrapper } from '@/lib/billing/stripe';

const theme = extendTheme({ colors });

const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

initMixpanel();

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  React.useEffect(() => {
    const handleRouteChange = (url) => {
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
      <GlobalStylesComponent />
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
                
                  window.$crisp.push(['set', 'session:segments', [['hive-app']]]);
                }
              `,
          }}
        />
      )}
      <UrqlProvider value={urqlClient}>
        <ChakraProvider theme={theme}>
          <LoadingAPIIndicator />
          <AuthProvider>
            <NavigationProvider>
              <HiveStripeWrapper>
                <Page>
                  <Component {...pageProps} />
                </Page>
              </HiveStripeWrapper>
            </NavigationProvider>
          </AuthProvider>
        </ChakraProvider>
      </UrqlProvider>
    </>
  );
}

export default App;
