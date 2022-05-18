import React from 'react';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import Head from 'next/head';
import 'twin.macro';
import { Button } from '@chakra-ui/react';
import { FullLogo } from '../common/Logo';

export const LoginPage = () => {
  const router = useRouteSelector();
  const returnTo = React.useRef<string>();

  React.useEffect(() => {
    if (router.route !== '/') {
      router.push('/', '/', {
        shallow: true,
      });
    }
  }, [router]);

  if (!returnTo.current) {
    returnTo.current = router.asPath ?? '/';
  }

  return (
    <>
      <Head>
        <title>Welcome to GraphQL Hive</title>
        <meta
          property="og:title"
          content="Welcome to GraphQL Hive"
          key="title"
        />
        <meta
          name="description"
          content="An open-source registry of schemas with many additional features to enhance your day-to-day work with GraphQL"
          key="description"
        />
        <meta
          property="og:url"
          key="og:url"
          content="https://app.graphql-hive.com"
        />
        <meta property="og:type" key="og:type" content="website" />
        <meta
          property="og:image"
          key="og:image"
          content="https://the-guild-og-image.vercel.app/**Manage%20your%20GraphQL%20APIs**.png?theme=light&md=1&fontSize=100px&images=https://graphql-hive.com/logo.svg&widths=800&heights=400"
        />
      </Head>
      <section tw="h-full text-gray-600">
        <div tw="container h-full px-5 py-24 mx-auto flex items-center justify-center">
          <div tw="lg:w-2/6 md:w-1/2 w-full bg-gray-50 rounded-lg p-8 flex flex-col">
            <FullLogo tw="text-yellow-500 mx-auto mb-5" />
            <Button
              as="a"
              href={`/api/login?returnTo=${returnTo.current}`}
              tw="mt-3"
              colorScheme="primary"
            >
              Sign in
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};
