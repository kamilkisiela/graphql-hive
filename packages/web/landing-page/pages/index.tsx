import React from 'react';
import tw from 'twin.macro';
import Head from 'next/head';
import { GlobalStyles } from 'twin.macro';
import {
  Header,
  FooterExtended,
  ThemeProvider,
  GlobalStyles as TGCStyles,
  useThemeContext,
} from '@theguild/components';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Pricing } from '../components/pricing';

const PrimaryLink = tw.a`
  inline-block
  bg-yellow-500 hover:bg-opacity-75
  dark:bg-yellow-600 dark:hover:bg-opacity-100 dark:hover:bg-yellow-500
  text-white px-6 py-3 rounded-lg font-medium
  shadow-sm
`;

const SecondaryLink = tw.a`
inline-block
  bg-gray-50 hover:bg-gray-100 
  dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700
  text-gray-600 px-6 py-3 rounded-lg font-medium
  shadow-sm
`;

const CookiesConsent: React.FC = () => {
  const [show, setShow] = React.useState(typeof window !== 'undefined' && localStorage.getItem('cookies') === null);

  const accept = React.useCallback(() => {
    setShow(false);
    localStorage.setItem('cookies', 'true');
  }, [setShow]);

  if (!show) {
    return null;
  }

  return (
    <div tw="w-full fixed bg-gray-100 px-5 py-7 bottom-0 flex gap-4 flex-wrap lg:flex-nowrap text-center lg:text-left items-center justify-center lg:justify-between">
      <div tw="w-full text-sm">
        <p>This website uses cookies to analyze site usage and improve your experience. </p>
        <p>If you continue to use our services, you are agreeing to the use of such cookies. </p>
      </div>
      <div tw="flex gap-4 items-center flex-shrink-0 lg:pr-24">
        <a href="/privacy-policy.pdf" tw="text-yellow-600 whitespace-nowrap hover:underline">
          Privacy Policy
        </a>
        <button
          tw="bg-yellow-500 px-5 py-2 text-white rounded-md hover:bg-yellow-700 focus:outline-none"
          onClick={accept}
        >
          Allow Cookies
        </button>
      </div>
    </div>
  );
};

const ITEMS = [
  {
    title: 'Open Source',
    description:
      'Community-based project where everyone can shape its future. Hive is also available as SaaS, with a free plan and transparent pricing.',
    imageSrc: '/open-source.svg',
    imageAlt: 'Open Source',
  },
  {
    title: 'Works with all GraphQL servers',
    description:
      'Aims to be compatible with any kind of GraphQL setup. Use the Hive agent/client in your server, or use the Hive CLI.',
    imageSrc: '/agnostic-framework.svg',
    imageAlt: 'Agnostic Framework',
  },
  {
    title: 'Works with any CI/CD',
    description: 'Integrates seamlessly with GitHub, and can easily be used with any CI/CD setup.',
    imageSrc: '/any-ci-cd.svg',
    imageAlt: 'Any CI/CD',
  },
  {
    title: 'Distributed Schemas',
    description: 'Supports any GraphQL schema setup: from a simple schema to Apollo Federation and Schema Stitching.',
    imageSrc: '/distributed-schemas.svg',
    imageAlt: 'Schemas',
  },
];

const gradients: [string, string][] = [
  ['#ff9472', '#f2709c'],
  ['#4776e6', '#8e54e9'],
  ['#f857a6', '#ff5858'],
  ['#ee9ca7', '#ffdde1'],
  ['#de6262', '#ffb88c'],
];

function pickGradient(i: number) {
  const gradient = gradients[i % gradients.length];

  if (!gradient) {
    throw new Error('No gradient found');
  }

  return gradient;
}

function GuildHeader() {
  const { isDarkTheme } = useThemeContext();
  const color = isDarkTheme ? '#000' : '#f9fafb';

  return (
    <Header
      wrapperProps={{
        style: {
          backgroundColor: color,
        },
      }}
      navigationProps={{
        style: {
          backgroundColor: color,
        },
      }}
      accentColor="#D49605"
      activeLink=""
      themeSwitch
      disableSearch
    />
  );
}

function Hero() {
  return (
    <div tw="w-full">
      <div tw="py-20 sm:py-24 lg:py-32 my-6">
        <h1 tw="max-w-screen-md mx-auto font-extrabold text-5xl sm:text-5xl lg:text-6xl text-center bg-gradient-to-r from-yellow-500 to-orange-600 dark:from-yellow-400 dark:to-orange-500 bg-clip-text text-transparent">
          Take full control of GraphQL API
        </h1>
        <p tw="max-w-screen-sm mx-auto mt-6 text-2xl text-gray-600 text-center dark:text-gray-400">
          Prevent breaking changes, monitor performance of your GraphQL API, and manage your API gateway
        </p>
        <div tw="mt-10 flex flex-row items-center justify-center gap-4">
          <PrimaryLink href="https://app.graphql-hive.com">Sign up for free</PrimaryLink>
          <SecondaryLink href="https://docs.graphql-hive.com">Documentation</SecondaryLink>
          <SecondaryLink href="https://github.com/kamilkisiela/graphql-hive">GitHub</SecondaryLink>
        </div>
      </div>
    </div>
  );
}

function Feature(props: {
  title: string;
  description: React.ReactNode;
  image: string | string[];
  href: string;
  gradient: number;
  flipped?: boolean;
}) {
  const [start, end] = pickGradient(props.gradient);

  return (
    <div tw="w-full">
      <div
        tw="container box-border px-6 mx-auto flex flex-row gap-x-24 items-center"
        style={{
          flexDirection: props.flipped ? 'row-reverse' : 'row',
        }}
      >
        <div tw="flex flex-col gap-4 w-1/3 flex-shrink-0">
          <h2 tw="font-semibold text-3xl text-black dark:text-white">{props.title}</h2>
          <div tw="text-gray-600 dark:text-gray-400 leading-7">{props.description}</div>
          <div>
            <SecondaryLink href={props.href}>Read more</SecondaryLink>
          </div>
        </div>
        {/* shadow-md border-2 */}
        <div
          tw="rounded-3xl overflow-hidden p-8 flex-grow flex flex-col justify-center items-center relative"
          style={{
            backgroundImage: `linear-gradient(to right, ${start}, ${end})`,
            // borderColor: props.flipped ? start : end,
          }}
        >
          {
            typeof props.image === 'string' ? <img src={props.image} tw="rounded-2xl" /> : null // implement slider
          }
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const title = 'GraphQL Hive - Schema Registry and Monitoring';
  const fullDescription =
    'Prevent breaking changes, monitor performance of your GraphQL API, and manage your API gateway (Federation, Stitching) with the Schema Registry. GraphQL Hive is a SAAS solution that is also 100% open source and can be self-hosted.';

  return (
    <ThemeProvider>
      <Head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <meta property="og:title" content={title} key="title" />
        <meta name="description" content={fullDescription} key="description" />
        <meta name="og:description" content={fullDescription} key="og:description" />
        <meta property="og:url" key="og:url" content="https://graphql-hive.com" />
        <meta property="og:type" key="og:type" content="website" />
        <meta
          property="og:image"
          key="og:image"
          content="https://og-image-guild.vercel.app/**Manage%20your%20GraphQL%20APIs**.png?theme=light&md=1&fontSize=100px&images=https://graphql-hive.com/logo.svg&widths=800&heights=400"
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en" />
        <meta name="twitter:card" key="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" key="twitter:site" content="@TheGuildDev" />
        <link rel="canonical" href="https://graphql-hive.com" />
      </Head>

      <Tooltip.Provider>
        <div tw="flex flex-col h-full">
          <style global jsx>{`
            * {
              font-family: Inter;
            }
            .dark {
              background-color: #0b0d11;
            }
            html,
            body,
            #__next {
              height: 100vh;
            }
            body {
              margin: 0;
            }
          `}</style>
          <GlobalStyles />
          <TGCStyles includeFonts={false} />
          <GuildHeader />
          <Hero />
          <div tw="flex flex-col gap-24 my-24">
            <Feature
              title="Schema Registry"
              description={
                <div tw="space-y-2">
                  <p>Push GraphQL schema to the registry and track the history of changes.</p>
                  <p>Get an overview of all GraphQL services in one place.</p>
                  <ul tw="ml-2 list-disc list-inside">
                    <li>Use with Apollo Federation</li>
                    <li>GraphQL Mesh, Stitching and more</li>
                    <li>Available in Global Edge Network</li>
                  </ul>
                </div>
              }
              image="/features/schema-history.png"
              href="https://docs.graphql-hive.com/features/publish-schema"
              gradient={0}
            />
            <Feature
              title="Prevent Breaking Changes"
              description={
                <div>
                  <p>Push GraphQL schema to the registry and track the history of changes.</p>
                  <p>Get an overview of all GraphQL services in one place.</p>
                </div>
              }
              image={ITEMS[1].imageSrc}
              gradient={1}
              href=""
              flipped
            />
          </div>
          <Pricing />
          <FooterExtended
            resources={[
              {
                title: 'Privacy Policy',
                href: '/privacy-policy.pdf',
                children: 'Privacy Policy',
              },
              {
                title: 'Terms of Use',
                href: '/terms-of-use.pdf',
                children: 'Terms of Use',
              },
            ]}
          />
        </div>
        <CookiesConsent />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}
