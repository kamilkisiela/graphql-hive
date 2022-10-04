import React from 'react';
import Head from 'next/head';
import 'twin.macro';
import { FullLogo } from '@/components/common/Logo';
import dynamic from 'next/dynamic';
import SuperTokensReact from 'supertokens-auth-react';

export function getServerSideProps() {
  return {
    props: {},
  };
}

const SuperTokensComponentNoSSR = dynamic(new Promise(res => res(SuperTokensReact.getRoutingComponent)) as any, {
  ssr: false,
});

/**
 * Route for showing the SuperTokens login page.
 */
export default function Auth(): React.ReactElement {
  return (
    <>
      <>
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
        <div>
          <FullLogo className="mx-auto my-5 text-yellow-500" width={150} color={{ main: '#fff', sub: '#fff' }} />
          <div tw="mx-auto bg-yellow-200 text-black sm:width[420px] width[76%] rounded-lg shadow-lg p-5 text-xs">
            We recently migrated from Auth0 to SuperTokens. If you have any issues, please contact us at{' '}
            <a href="mailto:kamil@graphql-hive.com" className="underline">
              kamil@graphql-hive.com
            </a>{' '}
            or using the{' '}
            <a
              href="#"
              className="underline"
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).$crisp) {
                  (window as any).$crisp.push(['do', 'chat:open']);
                }
              }}
            >
              in-app chat
            </a>
            .
          </div>
          <SuperTokensComponentNoSSR />
        </div>
      </>
    </>
  );
}
