import { ReactElement, useEffect } from 'react';
import { AppProps } from 'next/app';
import Script from 'next/script';
import Router from 'next/router';
import { initMixpanel } from '@/lib/mixpanel';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import GlobalStylesComponent from '@/components/common/GlobalStyles';
import * as gtag from '@/lib/gtag';
import { colors } from '@/lib/theme';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import '@/lib/graphiql.css';
import '../public/styles.css';
import cookies from 'js-cookie';
import Session from 'supertokens-auth-react/recipe/session';
import SuperTokens from 'supertokens-auth-react';
import { frontendConfig } from '@/config/frontend-config';
import { configureScope } from '@sentry/nextjs';
import { identify } from '@/lib/mixpanel';
import { LAST_VISITED_ORG_KEY, GA_TRACKING_ID, CRISP_WEBSITE_ID } from '@/constants';

const theme = extendTheme({ colors });

if (process.env.NODE_ENV === 'development' && 'window' in globalThis) {
  // Eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies -- only in dev mode
  // const whyDidYouRender = require('@welldone-software/why-did-you-render');
  // whyDidYouRender(React, {
  //   trackAllPureComponents: true,
  // });
}

declare global {
  interface Window {
    $crisp: any;
  }
}

function identifyOnCrisp(email: string): void {
  const crisp = globalThis.window.$crisp;
  if (crisp) {
    pushIfNotEmpty(crisp, 'user:email', email);
  }
}

function pushIfNotEmpty(crisp: any, key: string, value: string | undefined | null): void {
  if (value) {
    crisp.push(['set', key, value]);
  }
}

function identifyOnSentry(userId: string, email: string): void {
  configureScope(scope => {
    scope.setUser({ id: userId, email });
  });
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

  useEffect(() => {
    Session.doesSessionExist().then(async doesExist => {
      if (!doesExist) {
        return;
      }
      const payload = await Session.getAccessTokenPayloadSecurely();
      identifyOnCrisp(payload.email);
      identifyOnSentry(payload.superTokensUserId, payload.email);
      identify(payload.superTokensId, payload.email);
    });
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
      <ChakraProvider theme={theme}>
        <LoadingAPIIndicator />
        <Component {...pageProps} />
      </ChakraProvider>
    </>
  );
}
if (globalThis.window) {
  initMixpanel();
  SuperTokens.init(frontendConfig());
}

export default App;
