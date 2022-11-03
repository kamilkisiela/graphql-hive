import { ReactElement, useEffect } from 'react';
import { AppProps } from 'next/app';
import Script from 'next/script';
import Router from 'next/router';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import GlobalStylesComponent from '@/components/common/GlobalStyles';
import * as gtag from '@/lib/gtag';
import { colors } from '@/lib/theme';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import '@/lib/graphiql.css';
import '../public/styles.css';
import cookies from 'js-cookie';
import Session from 'supertokens-auth-react/recipe/session';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import { frontendConfig } from '@/config/supertokens/frontend';
import { configureScope } from '@sentry/nextjs';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { Provider as UrqlProvider } from 'urql';
import { urqlClient } from '@/lib/urql';
import { env } from '@/env/frontend';
import * as Sentry from '@sentry/react';

const theme = extendTheme({ colors });

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
      const lastVisitedOrgCookieValue = cookies.get(LAST_VISITED_ORG_KEY);

      // Make sure we do have orgId and the cookie is not in the legacy format
      if (lastVisitedOrgCookieValue?.includes(':') && orgId) {
        const [lastVisitedOrgId, checksum] = lastVisitedOrgCookieValue.split(':');

        if (orgId !== lastVisitedOrgId) {
          // Update the cookie with the new orgId
          cookies.set(LAST_VISITED_ORG_KEY, `${orgId}:${checksum}`);
        }
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
    });
  }, []);

  return (
    <>
      <GlobalStylesComponent />
      {env.analytics.googleAnalyticsTrackingId && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${env.analytics.googleAnalyticsTrackingId}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${env.analytics.googleAnalyticsTrackingId}', {
                  page_path: window.location.pathname,
                });`,
            }}
          />
        </>
      )}
      {env.analytics.crispWebsiteId && (
        <Script
          id="crisp-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.$crisp = [];
                window.CRISP_WEBSITE_ID = '${env.analytics.crispWebsiteId}';
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

      <SuperTokensWrapper>
        <UrqlProvider value={urqlClient}>
          <ChakraProvider theme={theme}>
            <LoadingAPIIndicator />
            <Component {...pageProps} />
          </ChakraProvider>
        </UrqlProvider>
      </SuperTokensWrapper>
    </>
  );
}
if (globalThis.window) {
  SuperTokens.init(frontendConfig());
  if (env.sentry) {
    Sentry.init({
      dsn: env.sentry.dsn,
      enabled: true,
      release: env.release,
      environment: env.environment,
    });
  }
}

export default App;
