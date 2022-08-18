import React from 'react';
import Head from 'next/head';
import 'twin.macro';
import { FullLogo } from '@/components/common/Logo';
import dynamic from 'next/dynamic';
import SuperTokensReact from 'supertokens-auth-react';
import { frontendConfig } from '@/config/frontend-config';

const SuperTokensComponentNoSSR = dynamic(new Promise(res => res(SuperTokensReact.getRoutingComponent)) as any, {
  ssr: false,
});

if (globalThis.window) {
  // we only want to call this init function on the frontend, so we check typeof window !== 'undefined'
  SuperTokensReact.init(frontendConfig());
}

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
        <section tw="h-full text-gray-600">
          <div tw="container h-full px-5 py-24 mx-auto flex items-center justify-center">
            <div tw="lg:w-2/6 md:w-1/2 w-full bg-white rounded-lg p-8 flex flex-col">
              <FullLogo tw="text-yellow-500 mx-auto mb-5" />
              <SuperTokensComponentNoSSR />
            </div>
          </div>
        </section>
      </>
    </>
  );
}
