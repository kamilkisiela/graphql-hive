import { ReactElement, useEffect } from 'react';
import { AppProps } from 'next/app';
import Script from 'next/script';
import Router from 'next/router';
import { initMixpanel } from '@/lib/mixpanel';
import { Provider as UrqlProvider } from 'urql';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { urqlClient } from '@/lib/urql';
import GlobalStylesComponent from '@/components/common/GlobalStyles';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Header } from '@/components/v2';
import * as gtag from '@/lib/gtag';
import { colors } from '@/lib/theme';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import '@/lib/graphiql.css';
import '../public/styles.css';
import { HiveStripeWrapper } from '@/lib/billing/stripe';
import cookies from 'js-cookie';
import { LAST_VISITED_ORG_KEY, GA_TRACKING_ID, CRISP_WEBSITE_ID } from '@/constants';

const theme = extendTheme({ colors });

initMixpanel();

if (process.env.NODE_ENV === 'development' && 'window' in globalThis) {
  // Eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies -- only in dev mode
  // const whyDidYouRender = require('@welldone-software/why-did-you-render');
  // whyDidYouRender(React, {
  //   trackAllPureComponents: true,
  // });
}

function App({ Component, pageProps }: AppProps): ReactElement {
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      gtag.pageview(url);

      const orgId = Router.query.orgId as string;
      if (orgId && orgId !== cookies.get(LAST_VISITED_ORG_KEY)) {
        cookies.set(LAST_VISITED_ORG_KEY, orgId);
      }
    };

    Router.events.on('routeChangeComplete', handleRouteChange);
    Router.events.on('hashChangeComplete', handleRouteChange);
    return () => {
      Router.events.off('routeChangeComplete', handleRouteChange);
      Router.events.off('hashChangeComplete', handleRouteChange);
    };
  }, []);

  return (
    <>
      <GlobalStylesComponent />
      {GA_TRACKING_ID && (
        <>
          <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`} />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', {
                  page_path: window.location.pathname,
                });`,
            }}
          />
        </>
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
              }`,
          }}
        />
      )}
      <UrqlProvider value={urqlClient}>
        <ChakraProvider theme={theme}>
          <LoadingAPIIndicator />
          <AuthProvider>
            <HiveStripeWrapper>
              <Header />
              <Component {...pageProps} />
            </HiveStripeWrapper>
          </AuthProvider>
        </ChakraProvider>
      </UrqlProvider>
    </>
  );
}

export default App;
