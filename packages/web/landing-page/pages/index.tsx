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
import { FiServer, FiGlobe, FiRadio, FiGithub } from 'react-icons/fi';
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
  bg-gray-100 hover:bg-gray-200
  dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700
  text-gray-600 px-6 py-3 rounded-lg font-medium
  shadow-sm
`;

const FeatureWrapper = tw.div`
  w-full py-24 
  odd:bg-gray-50
  odd:dark:bg-gray-900
  even:bg-white
  even:dark:bg-black
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

const gradients: [string, string][] = [
  ['#ff9472', '#f2709c'],
  ['#4776e6', '#8e54e9'],
  ['#f857a6', '#ff5858'],
  ['#4AC29A', '#BDFFF3'],
  ['#00c6ff', '#0072ff'],
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
        <div tw="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <PrimaryLink href="https://app.graphql-hive.com">Sign up for free</PrimaryLink>
          <SecondaryLink href="https://docs.graphql-hive.com">Documentation</SecondaryLink>
          <SecondaryLink tw="flex flex-row gap-2 items-center" href="https://github.com/kamilkisiela/graphql-hive">
            <FiGithub /> GitHub
          </SecondaryLink>
        </div>
      </div>
    </div>
  );
}

const Highlight = {
  Root: tw.div`flex flex-row md:flex-col lg:flex-row flex-1 gap-6`,
  Icon: tw.div`w-16 h-16 text-yellow-500 flex-shrink-0`,
  Content: tw.div`flex flex-col text-black dark:text-white`,
  Title: tw.h3`text-xl font-semibold`,
  Description: tw.p`text-gray-600 dark:text-gray-400`,
};

function Feature(props: {
  title: string;
  description: React.ReactNode;
  highlights?: Array<{
    title: string;
    description: React.ReactNode;
    icon?: React.ReactNode;
  }>;
  image: string;
  gradient: number;
  flipped?: boolean;
}) {
  const { title, description, highlights, image, gradient, flipped } = props;
  const [start, end] = pickGradient(gradient);

  return (
    <FeatureWrapper>
      <div tw="container box-border px-6 mx-auto flex flex-col gap-y-24">
        <div
          tw="flex flex-col gap-24 md:gap-12 lg:gap-24 items-start"
          css={[flipped ? tw`md:flex-row-reverse` : tw`md:flex-row`]}
        >
          <div tw="flex flex-col gap-4 w-full md:w-2/5 lg:w-1/3 flex-shrink-0">
            <h2
              tw="font-semibold text-5xl bg-clip-text text-transparent dark:text-transparent leading-normal"
              style={{
                backgroundImage: `linear-gradient(-70deg, ${end}, ${start})`,
              }}
            >
              {title}
            </h2>
            <div tw="text-lg text-gray-600 dark:text-gray-400 leading-7">{description}</div>
          </div>
          <div
            tw="rounded-3xl overflow-hidden p-8 flex-grow flex flex-col justify-center items-center relative"
            style={{
              backgroundImage: `linear-gradient(70deg, ${start}, ${end})`,
            }}
          >
            <img src={image} tw="rounded-2xl" />
          </div>
        </div>
        {Array.isArray(highlights) && highlights.length > 0 ? (
          <div tw="flex flex-col md:flex-row gap-12 justify-between">
            {highlights.map(({ title, description, icon }, i) => (
              <Highlight.Root key={i}>
                <Highlight.Icon>{icon}</Highlight.Icon>
                <Highlight.Content>
                  <Highlight.Title>{title}</Highlight.Title>
                  <Highlight.Description>{description}</Highlight.Description>
                </Highlight.Content>
              </Highlight.Root>
            ))}
          </div>
        ) : null}
      </div>
    </FeatureWrapper>
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
          <div tw="flex flex-col">
            <Feature
              title="Schema Registry"
              description={
                <div tw="space-y-2">
                  <p>Push GraphQL schema to the registry and track the history of changes.</p>
                  <p>All your GraphQL services in one place.</p>
                </div>
              }
              highlights={[
                {
                  title: 'Manage your Gateway',
                  description: 'Connect to Apollo Federation, GraphQL Mesh, Stitching and more.',
                  icon: <FiServer tw="w-full h-full" />,
                },
                {
                  title: 'Global Edge Network',
                  description: 'Access the registry from any place on earth within milliseconds.',
                  icon: <FiGlobe tw="w-full h-full" />,
                },
                {
                  title: 'Make it smarter',
                  description: 'Detect unused parts of Schema thanks to GraphQL analytics.',
                  icon: <FiRadio tw="w-full h-full" />,
                },
              ]}
              image="/features/schema-history.png"
              gradient={0}
            />
            <Feature
              title="Monitoring"
              description={
                <div tw="flex flex-col gap-y-24">
                  <div>
                    <p>Be aware of how your GraphQL API is used and what is the experience of its final users.</p>
                  </div>
                  <div tw="flex flex-col gap-y-12">
                    <Highlight.Root>
                      <Highlight.Content>
                        <Highlight.Title tw="text-lg">GraphQL Consumers</Highlight.Title>
                        <Highlight.Description tw="text-sm">
                          Track every source of GraphQL requests and see how the API is consumed.
                        </Highlight.Description>
                      </Highlight.Content>
                    </Highlight.Root>
                    <Highlight.Root>
                      <Highlight.Content>
                        <Highlight.Title tw="text-lg">Overall performance</Highlight.Title>
                        <Highlight.Description tw="text-sm">
                          Get a global overview of the usage of your GraphQL API.
                        </Highlight.Description>
                      </Highlight.Content>
                    </Highlight.Root>
                    <Highlight.Root>
                      <Highlight.Content>
                        <Highlight.Title tw="text-lg">Query performance</Highlight.Title>
                        <Highlight.Description tw="text-sm">
                          Detect slow GraphQL Operations and identify the culprits.
                        </Highlight.Description>
                      </Highlight.Content>
                    </Highlight.Root>
                  </div>
                </div>
              }
              image="/features/monitoring-preview.png"
              gradient={1}
              flipped
            />
            <Feature
              title="Analytics"
              description={
                <div tw="flex flex-col gap-y-12">
                  <div>
                    <p>Maintain your GraphQL API across many teams without concerns.</p>
                  </div>
                  <div tw="flex flex-col gap-y-12">
                    <Highlight.Root>
                      <Highlight.Content>
                        <Highlight.Title tw="text-lg">Prevent Breaking Changes</Highlight.Title>
                        <Highlight.Description tw="text-sm">
                          Combination of Schema Registry and GraphQL Monitoring helps you evolve your GraphQL API.
                        </Highlight.Description>
                      </Highlight.Content>
                    </Highlight.Root>
                    <Highlight.Root>
                      <Highlight.Content>
                        <Highlight.Title tw="text-lg">Detect unused fields</Highlight.Title>
                        <Highlight.Description tw="text-sm">
                          Helps you understand the coverage of GraphQL schema and safely remove the unused part.
                        </Highlight.Description>
                      </Highlight.Content>
                    </Highlight.Root>
                    <Highlight.Root>
                      <Highlight.Content>
                        <Highlight.Title tw="text-lg">Alerts and notifications</Highlight.Title>
                        <Highlight.Description tw="text-sm">
                          Stay on top of everything with Slack notifications.
                        </Highlight.Description>
                      </Highlight.Content>
                    </Highlight.Root>
                  </div>
                </div>
              }
              image="/any-ci-cd.svg"
              gradient={2}
            />
            <FeatureWrapper>
              <div tw="container box-border px-6 mx-auto flex flex-col gap-y-24">
                <div tw="text-center">
                  <h2
                    tw="font-semibold text-5xl mb-6 bg-clip-text text-transparent dark:text-transparent leading-normal"
                    style={{
                      backgroundImage: `linear-gradient(-70deg, ${gradients[3][1]}, ${gradients[3][0]})`,
                    }}
                  >
                    Open-Source
                  </h2>
                  <p tw="text-lg text-gray-600 dark:text-gray-400 leading-7">Built entirely in public.</p>
                </div>
                <div tw="max-w-screen-lg px-6 box-border mx-auto grid grid-cols-2 gap-12">
                  <Highlight.Root>
                    <Highlight.Content>
                      <Highlight.Title tw="text-lg">Public roadmap</Highlight.Title>
                      <Highlight.Description tw="text-sm">Influence the future of GraphQL Hive.</Highlight.Description>
                    </Highlight.Content>
                  </Highlight.Root>
                  <Highlight.Root>
                    <Highlight.Content>
                      <Highlight.Title tw="text-lg">Cloud and Self-Hosted</Highlight.Title>
                      <Highlight.Description tw="text-sm">
                        MIT licensed, host it on your own infrastructure.
                      </Highlight.Description>
                    </Highlight.Content>
                  </Highlight.Root>
                  <Highlight.Root>
                    <Highlight.Content>
                      <Highlight.Title tw="text-lg">Available for free</Highlight.Title>
                      <Highlight.Description tw="text-sm">
                        Free Hobby plan that fits perfectly for most side projects.
                      </Highlight.Description>
                    </Highlight.Content>
                  </Highlight.Root>
                  <Highlight.Root>
                    <Highlight.Content>
                      <Highlight.Title tw="text-lg">Community</Highlight.Title>
                      <Highlight.Description tw="text-sm">
                        Implement your own features with our help.
                      </Highlight.Description>
                    </Highlight.Content>
                  </Highlight.Root>
                </div>
              </div>
            </FeatureWrapper>
          </div>
          <Pricing gradient={gradients[4]} />
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
