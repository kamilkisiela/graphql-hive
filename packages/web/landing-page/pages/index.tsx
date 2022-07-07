import React from 'react';
import { HeroGradient, HeroIllustration } from '@theguild/components';
import Head from 'next/head';
import { GlobalStyles } from 'twin.macro';
import { css } from 'twin.macro';
import { Header, FooterExtended, GlobalStyles as TGCStyles, ThemeProvider } from '@theguild/components';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Pricing } from '../components/pricing';

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

const heroWrapper = css`
  @media only screen and (min-width: 500px) {
    & img {
      margin-top: 4%;
      margin-right: 7%;
    }
  }
  @media only screen and (max-width: 768px) {
    & img {
      margin-right 25%;
    }
  }
  @media only screen and (max-width: 500px) {
    & img {
      display: none !important;
    }
    & div:nth-child(2) {
      justify-content: center;
    }
    & h1 {
      margin-top: 2.5rem !important;
    }
    & div {
      padding-bottom: 0.1rem;
    }
  }
`;

export default function Index() {
  const title = 'GraphQL Hive - Manage your GraphQL API workflows';
  const description =
    'An open-source GraphQL schema registry with many additional features to enhance your day-to-day work with GraphQL.';

  return (
    <ThemeProvider>
      <Head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <meta property="og:title" content={title} key="title" />
        <meta name="description" content={description} key="description" />
        <meta name="og:description" content={description} key="og:description" />
        <meta property="og:url" key="og:url" content="https://graphql-hive.com" />
        <meta property="og:type" key="og:type" content="website" />
        <meta
          property="og:image"
          key="og:image"
          content="https://the-guild-og-image.vercel.app/**Manage%20your%20GraphQL%20APIs**.png?theme=light&md=1&fontSize=100px&images=https://graphql-hive.com/logo.svg&widths=800&heights=400"
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
          <Header accentColor="#D49605" activeLink="" disableSearch />
          <div css={heroWrapper}>
            <HeroGradient
              title="Manage your GraphQL API workflow"
              description={description}
              colors={['#FFB21D']}
              image={{
                src: '/manage.svg',
                alt: 'Manage workflows',
              }}
              link={[
                {
                  target: '_blank',
                  href: 'https://app.graphql-hive.com',
                  title: 'Go to app',
                  children: 'Go to app',
                },
                {
                  target: '_blank',
                  href: 'https://docs.graphql-hive.com',
                  title: 'Documentation',
                  children: 'Documentation',
                  style: {
                    color: '#fff',
                    border: '1px solid #fff',
                    background: 'transparent',
                  },
                },
                {
                  target: '_blank',
                  href: 'https://github.com/kamilkisiela/graphql-hive',
                  title: 'GitHub',
                  children: 'GitHub',
                  style: {
                    color: '#fff',
                    border: '1px solid #fff',
                    background: 'transparent',
                  },
                },
              ]}
            />
          </div>
          {ITEMS.map((option, i) => {
            return (
              <HeroIllustration
                key={option.title}
                title={option.title}
                description={option.description}
                image={{
                  src: option.imageSrc,
                  alt: option.imageAlt,
                }}
                flipped={i % 2 !== 0}
              />
            );
          })}
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
