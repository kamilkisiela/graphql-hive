import { ReactElement, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { ThirdPartyEmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/thirdpartyemailpassword/prebuiltui';
import { getRoutingComponent } from 'supertokens-auth-react/ui';
import { FullLogo } from '@/components/common/Logo';
import { env } from '@/env/frontend';
import { startAuthFlowForProvider } from '@/lib/supertokens/start-auth-flow-for-provider';
import { startAuthFlowForOIDCProvider } from '@/lib/supertokens/third-party-email-password-react-oidc-provider';

export const getServerSideProps: GetServerSideProps = async context => {
  // See counter-part in '@/config/supertokens/frontend.ts'
  if (env.auth.organizationOIDC === true) {
    const url = new URL(env.appBaseUrl + (context.req.url ?? ''));
    const oidcProviderId = url.searchParams.get('id');

    if (url.pathname === '/auth/oidc' && oidcProviderId) {
      return {
        props: {
          oidcProviderId,
        },
      };
    }
  }

  return {
    props: { oidcProviderId: null },
  };
};

const SuperTokensComponentNoSSR = dynamic(
  () => Promise.resolve(() => getRoutingComponent([ThirdPartyEmailPasswordPreBuiltUI])),
  {
    ssr: false,
  },
);

/**
 * Route for showing the SuperTokens login page.
 */
export default function Auth(props: { oidcProviderId: string | null }): ReactElement {
  useEffect(() => {
    if (props.oidcProviderId) {
      void startAuthFlowForOIDCProvider(props.oidcProviderId);
      return;
    }

    // In case we are directed here from the Okta dashboard we automatically start the login flow.
    const isOkta =
      env.auth.okta !== null &&
      new URLSearchParams(globalThis.window?.location.search ?? '').get('provider') === 'okta';

    if (isOkta) {
      void startAuthFlowForProvider('okta');
    }
  }, []);

  return (
    <div>
      <Head>
        <title>Welcome to GraphQL Hive</title>
        <meta property="og:title" content="Welcome to GraphQL Hive" key="title" />
        <meta
          name="description"
          content="An open-source registry of schemas with many additional features to enhance your day-to-day work with GraphQL"
          key="description"
        />
        <meta property="og:url" key="og:url" content="https://app.graphql-hive.com" />
        <meta property="og:type" key="og:type" content="website" />
        <meta
          property="og:image"
          key="og:image"
          content="https://the-guild-og-image.vercel.app/**Manage%20your%20GraphQL%20APIs**.png?theme=light&md=1&fontSize=100px&images=https://graphql-hive.com/logo.svg&widths=800&heights=400"
        />
      </Head>
      <FullLogo
        className="mx-auto my-5 text-yellow-500"
        width={150}
        color={{ main: '#fff', sub: '#fff' }}
      />
      {props.oidcProviderId ? null : <SuperTokensComponentNoSSR />}
    </div>
  );
}
