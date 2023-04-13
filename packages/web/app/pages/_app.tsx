import { ReactElement, useEffect } from 'react';
import { AppProps } from 'next/app';
import Router from 'next/router';
import Script from 'next/script';
import cookies from 'js-cookie';
import { ToastContainer } from 'react-toastify';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import { Provider as UrqlProvider } from 'urql';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import { frontendConfig } from '@/config/supertokens/frontend';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { env } from '@/env/frontend';
import * as gtag from '@/lib/gtag';
import { urqlClient } from '@/lib/urql';
import { configureScope, init } from '@sentry/nextjs';
import '../public/styles.css';
import 'react-toastify/dist/ReactToastify.css';

function identifyOnCrisp(email: string): void {
  if (email) {
    window.$crisp?.push(['set', 'user:email', email]);
  }
}

function identifyOnSentry(userId: string, email: string): void {
  configureScope(scope => {
    scope.setUser({ id: userId, email });
  });
}

export default function App({ Component, pageProps }: AppProps): ReactElement {
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
    void Session.doesSessionExist().then(async doesExist => {
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
          <LoadingAPIIndicator />
          <Component {...pageProps} />
        </UrqlProvider>
      </SuperTokensWrapper>

      <ToastContainer hideProgressBar />
    </>
  );
}
if (globalThis.window) {
  SuperTokens.init(frontendConfig());
  if (env.sentry) {
    init({
      dsn: env.sentry.dsn,
      enabled: true,
      release: env.release,
      environment: env.environment,
    });
  }
}
