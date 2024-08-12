import { ComponentPropsWithoutRef, ReactElement, ReactNode, useState } from 'react';
import Head from 'next/head';
import Image, { StaticImageData } from 'next/image';
import Link from 'next/link';
import { FiGithub, FiGlobe, FiLogIn, FiPackage, FiServer, FiTruck } from 'react-icons/fi';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../lib';
import { ArrowIcon } from './arrow-icon';
import { BookIcon } from './book-icon';
import { CallToAction } from './call-to-action';
import { CheckIcon, Hero, HeroFeatures, HeroLinks, TrustedBy } from './hero';
import { Highlights, HighlightTextLink } from './highlights';
import { AligentLogo, KarrotLogo, LinktreeLogo, MeetupLogo, SoundYXZLogo } from './logos';
import { Page } from './page';
import { Pricing } from './pricing';
import { StatsItem, StatsList } from './stats';
import observabilityClientsImage from '../../public/features/observability/clients.png';
import observabilityOperationsImage from '../../public/features/observability/operations.png';
import observabilityOverallImage from '../../public/features/observability/overall.png';
import registryExplorerImage from '../../public/features/registry/explorer.png';
import registrySchemaChecksImage from '../../public/features/registry/schema-checks.png';
import registryVersionControlSystemImage from '../../public/features/registry/version-control-system.png';

const classes = {
  root: cn('flex flex-1 flex-row gap-6 md:flex-col lg:flex-row'),
  content: cn('flex flex-col text-black'),
  title: cn('text-xl font-semibold'),
  description: cn('text-gray-600'),
};

const gradients: [string, string][] = [
  ['#ff9472', '#f2709c'],
  ['#4776e6', '#8e54e9'],
  ['#f857a6', '#ff5858'],
  ['#4ac29a', '#bdfff3'],
  ['#00c6ff', '#0072ff'],
];

const renderFeatures = ({
  title,
  description,
  documentationLink,
}: {
  title: string;
  description: ReactNode;
  documentationLink?: string;
}) => (
  <div className={classes.root} key={title}>
    <div className={classes.content}>
      <h3 className={cn(classes.title, 'text-lg')}>{title}</h3>
      <p className={cn(classes.description, 'text-sm')}>{description}</p>
      {documentationLink ? (
        <Link
          href={documentationLink}
          className="group mt-2 inline-flex items-center gap-x-2 text-sm underline-offset-8 transition hover:underline"
        >
          <div>
            <BookIcon size={16} />
          </div>
          <div>Learn more</div>
        </Link>
      ) : null}
    </div>
  </div>
);

function Feature(props: {
  icon: ReactNode;
  title: string;
  description: string;
  highlights: {
    title: string;
    description: string;
    image: StaticImageData;
  }[];
  documentationLink?: string;
}) {
  const [activeHighlight, setActiveHighlight] = useState(0);
  const { icon, title, description, documentationLink, highlights } = props;

  return (
    <>
      <Head>
        {highlights
          ? highlights.map(highlight => (
              <link key={highlight.image.src} rel="preload" as="image" href={highlight.image.src} />
            ))
          : null}
      </Head>
      <article className="grid grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col gap-6 px-4 md:gap-12 md:pl-12 md:pr-16">
          <header className="flex flex-col gap-4 md:gap-6">
            <div className="w-fit rounded-lg bg-[linear-gradient(135deg,#68A8B6,#3B736A)] p-[9px] text-white">
              {icon}
            </div>
            <Heading as="h2" size="md" className="text-green-1000">
              {title}
            </Heading>
            <p className="leading-6 text-green-800">{description}</p>
          </header>
          <dl className="grid grid-cols-2 gap-4 md:gap-12">
            {highlights.map((highlight, i) => {
              return (
                <div key={highlight.title} onPointerOver={() => setActiveHighlight(i)}>
                  <dt className="text-green-1000 font-medium">{highlight.title}</dt>
                  <dd className="mt-2 text-sm leading-[20px] text-green-800">
                    {highlight.description}
                  </dd>
                </div>
              );
            })}
          </dl>
          <CallToAction variant="primary" href={documentationLink}>
            Learn more
            <ArrowIcon />
          </CallToAction>
        </div>
        {highlights.map((highlight, i) => (
          <div key={i} className={cn('h-full', activeHighlight === i ? 'block' : 'hidden')}>
            <div className="relative px-4 sm:px-6 lg:hidden">
              <p className="relative mx-auto max-w-2xl text-base text-black sm:text-center">
                {highlight.description}
              </p>
            </div>
            <div className="relative ml-6 h-full flex-1 overflow-hidden rounded-3xl bg-blue-400">
              {/* TODO: Use cropped images so we don't load too much without need. */}
              <Image
                width={925}
                height={578}
                src={highlight.image}
                className="absolute left-[55px] top-[108px] rounded-3xl object-cover"
                role="presentation"
                alt=""
              />
            </div>
          </div>
        ))}
      </article>
    </>
  );
}

export function IndexPage(): ReactElement {
  return (
    <Tooltip.Provider>
      <Page>
        <Hero>
          <Heading
            as="h1"
            size="xl"
            className="mx-auto max-w-3xl text-balance text-center text-white"
          >
            Open-source GraphQL management platform
          </Heading>
          <p className="mx-auto w-[512px] max-w-[80%] text-center font-medium leading-6 text-white/80">
            Your GraphQL API stack in one place: seamlessly integrate, customize, and secure all API
            environments without vendor lock-in.
          </p>
          <HeroFeatures>
            <li>
              <CheckIcon className="text-blue-400" />
              Fully open-source
            </li>
            <li>
              <CheckIcon className="text-blue-400" />
              No vendor lock
            </li>
            <li>
              <CheckIcon className="text-blue-400" />
              Can be self-hosted!
            </li>
          </HeroFeatures>
          <HeroLinks>
            <CallToAction variant="primary-inverted" href="https://app.graphql-hive.com">
              Get started for free
            </CallToAction>
            <CallToAction variant="secondary" href="/docs">
              View Pricing
            </CallToAction>
          </HeroLinks>
        </Hero>
        <FeatureTabs className="relative top-[-68px]" />
        <div className="relative even:bg-gray-50">
          <StatsList>
            <StatsItem label="Happy users" value={5.7} suffix="K" decimal />
            <StatsItem label="Registered Schemas" value={225} suffix="K" />
            <StatsItem label="Collected Operations" value={315} suffix="B" />
            <StatsItem label="GitHub Commits" value={6.2} suffix="K" decimal />
          </StatsList>
        </div>
        <TrustedBy>
          <MeetupLogo
            className="opacity-50 transition-opacity duration-300 ease-in-out hover:opacity-100"
            height={32}
          />
          <LinktreeLogo
            className="opacity-50 transition-opacity duration-300 ease-in-out hover:opacity-100"
            height={22}
          />
          <KarrotLogo
            height={28}
            className="opacity-50 transition-opacity duration-300 ease-in-out hover:opacity-100"
          />
          <AligentLogo
            className="opacity-50 transition-opacity duration-300 ease-in-out hover:opacity-100"
            height={32}
          />
          <SoundYXZLogo
            className="opacity-50 transition-opacity duration-300 ease-in-out hover:opacity-100"
            height={32}
          />
        </TrustedBy>
        <div className="flex flex-col">
          <div className={cn('relative overflow-hidden')}>
            <div>
              <div className="absolute top-0 h-px w-full bg-gradient-to-r from-gray-300 via-gray-500 to-gray-300 opacity-25" />
              <div className="absolute left-[-200px] top-[-200px] h-[255px] w-[60vw] bg-gradient-to-b from-gray-50 to-gray-300 opacity-15 blur-3xl" />
              <div className="absolute right-[-200px] top-[-200px] h-[255px] w-[60vw] bg-gradient-to-b from-gray-300 to-gray-50 opacity-15 blur-3xl" />
            </div>
            <div className="py-24">
              <h2 className="base:mr-1 mb-12 ml-1 text-center text-3xl font-semibold leading-normal tracking-tight text-black">
                Perfect fit for your GraphQL Gateway
              </h2>
              <Highlights
                items={[
                  {
                    title: 'Manage your Gateway',
                    description: (
                      <>
                        Connect to{' '}
                        <HighlightTextLink href="/docs/get-started/apollo-federation">
                          Apollo Federation
                        </HighlightTextLink>
                        ,{' '}
                        <HighlightTextLink href="/docs/integrations/graphql-mesh">
                          GraphQL Mesh
                        </HighlightTextLink>
                        ,{' '}
                        <HighlightTextLink href="/docs/integrations/schema-stitching">
                          Stitching
                        </HighlightTextLink>{' '}
                        and more.
                      </>
                    ),
                    icon: <FiServer strokeWidth={1} className="size-full" />,
                    documentationLink: '/docs/get-started/apollo-federation',
                  },
                  {
                    title: 'Global Edge Network',
                    description: 'Access the registry from any place on earth within milliseconds.',
                    icon: <FiGlobe strokeWidth={1} className="size-full" />,
                    documentationLink: '/docs/features/high-availability-cdn',
                  },
                  {
                    title: 'Apollo Studio alternative',
                    description:
                      'GraphQL Hive is a drop-in replacement for Apollo Studio (Apollo GraphOS).',
                    icon: <FiPackage strokeWidth={1} className="size-full" />,
                    documentationLink: '/docs/use-cases/apollo-studio',
                  },
                ]}
              />
            </div>
          </div>

          <div
            className="relative overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(-70deg, ${gradients[4][1]}, ${gradients[4][0]})`,
            }}
          >
            <div>
              <div className="absolute top-0 h-px w-full bg-blue-900 opacity-25" />
            </div>
            <div className="py-24">
              <div className="mx-auto max-w-lg text-center text-white">
                <h2 className="text-3xl font-semibold leading-normal tracking-tight">
                  Get started today
                </h2>
                <p className="mt-4 text-lg tracking-tight">
                  Start with a free Hobby plan that fits perfectly most side projects or try our Pro
                  plan with 30 days trial period.
                </p>
                <a
                  href="https://app.graphql-hive.com"
                  className={cn(
                    'mt-12 rounded-md px-6 py-3 text-sm font-medium text-black shadow-sm',
                    'bg-white hover:bg-blue-50',
                    'inline-flex flex-row items-center gap-2',
                  )}
                >
                  <FiLogIn /> Enter Hive
                </a>
              </div>
            </div>
          </div>
          <div className={cn('relative overflow-hidden')}>
            <div>
              <div className="absolute top-0 h-px w-full bg-gradient-to-r from-gray-300 via-gray-500 to-gray-300 opacity-25" />
              <div className="absolute left-[-200px] top-[-200px] h-[255px] w-[60vw] bg-gradient-to-b from-gray-600 to-gray-900 opacity-15 blur-3xl" />
              <div className="absolute right-[-200px] top-[-200px] h-[255px] w-[60vw] bg-gradient-to-b from-gray-900 to-gray-600 opacity-15 blur-3xl" />
            </div>
            <div className="py-24">
              <h2 className="mb-12 text-center text-3xl font-semibold leading-normal tracking-tight text-black">
                Fits your infrastructure
              </h2>
              <Highlights
                items={[
                  {
                    title: 'GitHub Integration',
                    description: 'Our CLI integrates smoothly with GitHub Actions / repositories.',
                    icon: <FiGithub strokeWidth={1} className="size-full" />,
                    documentationLink: '/docs/integrations/ci-cd#github-check-suites',
                  },
                  {
                    title: 'Works with every CI/CD',
                    description: 'Connect GraphQL Hive CLI to CI/CD of your choice.',
                    icon: <FiTruck strokeWidth={1} className="size-full" />,
                    documentationLink: '/docs/integrations/ci-cd',
                  },
                  {
                    title: 'On-premise or Cloud',
                    description:
                      'GraphQL Hive is MIT licensed, you can host it on your own infrastructure.',
                    icon: <FiServer strokeWidth={1} className="size-full" />,
                    documentationLink: '/docs/self-hosting/get-started',
                  },
                ]}
              />
            </div>
          </div>
          <div className={cn('relative overflow-hidden')}>
            <div>
              <div
                className="absolute top-0 h-px w-full opacity-25"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${gradients[3][1]}, ${gradients[3][0]})`,
                }}
              />
              <div
                className="absolute left-[-200px] top-[-200px] h-[255px] w-[60vw] opacity-15 blur-3xl"
                style={{
                  backgroundImage: `linear-gradient(180deg, ${gradients[3][0]}, ${gradients[3][1]})`,
                }}
              />
              <div
                className="absolute right-[-200px] top-[-200px] h-[255px] w-[60vw] opacity-15 blur-3xl"
                style={{
                  backgroundImage: `linear-gradient(180deg, ${gradients[3][1]}, ${gradients[3][0]})`,
                }}
              />
            </div>
            <div className="py-24">
              <div className="container mx-auto box-border flex flex-col gap-y-24 px-6">
                <div className="text-center">
                  <h2
                    className="mb-6 bg-clip-text text-5xl font-semibold leading-normal text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(-70deg, ${gradients[3][1]}, ${gradients[3][0]})`,
                    }}
                  >
                    Open-Source
                  </h2>
                  <p className="text-lg leading-7 text-gray-600">Built entirely in public.</p>
                </div>
                <div className="mx-auto box-border grid max-w-screen-lg grid-cols-2 gap-12 px-6">
                  {[
                    {
                      title: 'Public roadmap',
                      description: 'Influence the future of GraphQL Hive.',
                    },
                    {
                      title: 'Cloud and Self-Hosted',
                      description: 'MIT licensed, host it on your own infrastructure.',
                    },
                    {
                      title: 'Available for free',
                      description: 'Free Hobby plan that fits perfectly for most side projects.',
                    },
                    {
                      title: 'Community',
                      description: 'Implement your own features with our help.',
                    },
                  ].map(renderFeatures)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <Pricing gradient={gradients[4]} />
      </Page>
    </Tooltip.Provider>
  );
}

function FeatureTabs({ className }: { className?: string }) {
  const tabs = ['Schema Registry', 'GraphQL Observability', 'Schema Management'];
  const icons = [<SchemaRegistryIcon />, <GraphQLObservabilityIcon />, <SchemaManagementIcon />];

  return (
    <section className={cn('mx-auto w-[1200px] max-w-full rounded-3xl bg-white md:p-6', className)}>
      <Tabs.Root defaultValue={tabs[0]}>
        <Tabs.List className="bg-beige-200 mb-12 flex flex-row rounded-2xl">
          {tabs.map((tab, i) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className={
                "data-[state='active']:text-green-1000 data-[state='active']:border-beige-600 data-[state='active']:bg-white" +
                ' border border-transparent font-medium leading-6 text-green-800' +
                ' flex flex-1 justify-center gap-2.5 rounded-[15px] p-2 md:p-4'
              }
            >
              {icons[i]}
              {tab}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="Schema Registry" tabIndex={-1}>
          <Feature
            title="Schema Registry"
            icon={<SchemaRegistryIcon />}
            documentationLink="/docs/features/schema-registry"
            description="A comprehensive Schema Registry to track and manage all changes in your GraphQL schemas."
            highlights={[
              {
                title: 'Version Control System',
                description:
                  'Track modifications precisely across multiple environments from staging to production.',
                image: registryVersionControlSystemImage,
              },
              {
                title: 'Schema Checks',
                description:
                  'Enhance reliability in consumer apps with proactive detection for smooth API evolution.',
                image: registrySchemaChecksImage,
              },
              {
                title: 'Composition Error Prevention',
                description:
                  'Safeguard your gateway’s operation, preventing systemic failures that could halt your enterprise processes.',
                image: registrySchemaChecksImage, // TODO: Replace with correct image
              },
              {
                title: 'Schema Explorer',
                description: 'Navigate and analyze the connections within your GraphQL schema.',
                image: registryExplorerImage,
              },
            ]}
          />
        </Tabs.Content>
        <Tabs.Content value="GraphQL Observability" tabIndex={-1}>
          <Feature
            title="GraphQL Observability"
            icon={<GraphQLObservabilityIcon />}
            documentationLink="/docs/features/usage-reporting"
            description="Enhanced GraphQL Observability tools provide insights into API usage and user experience metrics."
            highlights={[
              {
                title: 'GraphQL consumers',
                description:
                  'Track each GraphQL request source to monitor how the APIs are utilized, optimizing resource management.',
                image: observabilityClientsImage,
              },
              {
                title: 'Overall performance',
                description: 'Global dashboard for an overarching view of your GraphQL API usage.',
                image: observabilityOverallImage,
              },
              {
                title: 'Query performance',
                description:
                  'Identify and analyze slow GraphQL operations to pinpoint performance bottlenecks.',
                image: observabilityOperationsImage,
              },
            ]}
          />
        </Tabs.Content>
        <Tabs.Content value="Schema Management" tabIndex={-1}>
          <Feature
            title="Schema Management"
            icon={<SchemaManagementIcon />}
            description="Optimize your GraphQL APIs for clear visibility and control over team modifications, ensuring cohesive and efficient evolution."
            highlights={[
              {
                title: 'Prevent breaking changes',
                description:
                  'Integrated Schema Registry with GraphQL Monitoring for confident API evolution.',
                image: observabilityOverallImage,
              },
              {
                title: 'Detect unused fields',
                description:
                  'Hive detects and removes unused fields in your GraphQL schema for efficiency and tidiness.',
                image: observabilityOverallImage,
              },
              {
                title: 'Schema Policy',
                description:
                  'Hive provides tools to lint, verify, and enforce coding best practices across your federated GraphQL architecture.',
                image: observabilityOverallImage,
              },
            ]}
          />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}

interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
  as: 'h1' | 'h2' | 'h3';
  size: 'xl' | 'md' | 'sm';
}
function Heading({ as: _as, size, className, ...rest }: HeadingProps) {
  const Level = _as || 'h2';

  let sizeStyle = '';
  switch (size) {
    case 'xl':
      sizeStyle = 'text-4xl leading-[1.2] md:text-6xl md:leading-[1.1875]';
      break;
    case 'md':
      sizeStyle = 'text-4xl leading-[1.2] md:text-5xl md:leading-[1.16667]';
      break;
    case 'sm':
      sizeStyle = 'text-xl leading-[1.2]';
      break;
  }

  return <Level className={cn(sizeStyle, 'tracking-[-0.64px]', className)} {...rest} />;
}

function SchemaRegistryIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M5.25 7.5a2.25 2.25 0 1 1 3 2.122v4.756a2.251 2.251 0 1 1-1.5 0V9.622A2.25 2.25 0 0 1 5.25 7.5Zm9.22-2.03a.75.75 0 0 1 1.06 0l.97.97.97-.97a.75.75 0 1 1 1.06 1.06l-.97.97.97.97a.75.75 0 0 1-1.06 1.06l-.97-.97-.97.97a.75.75 0 1 1-1.06-1.06l.97-.97-.97-.97a.75.75 0 0 1 0-1.06Zm2.03 5.03a.75.75 0 0 1 .75.75v3.128a2.251 2.251 0 1 1-1.5 0V11.25a.75.75 0 0 1 .75-.75Z" />
    </svg>
  );
}

function GraphQLObservabilityIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M11.1 19.2v-6.3H9.3v-2.7h5.4v2.7h-1.8v6.3h4.5V21H6.6v-1.8h4.5Zm-.9-16V2.1h3.6v1.1a8.102 8.102 0 0 1 2.694 14.64l-1-1.497a6.3 6.3 0 1 0-6.99 0l-.998 1.497A8.103 8.103 0 0 1 10.2 3.2Z" />
    </svg>
  );
}

function SchemaManagementIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
      <path d="M7.761 9.111a2.701 2.701 0 0 0 2.606 1.989h3.6a4.5 4.5 0 0 1 4.434 3.731 2.7 2.7 0 1 1-3.489 3.075 2.7 2.7 0 0 1 1.66-3.017 2.702 2.702 0 0 0-2.605-1.989h-3.6a4.48 4.48 0 0 1-2.7-.9v2.853a2.701 2.701 0 1 1-1.8 0V9.147a2.7 2.7 0 1 1 1.894-.036ZM6.767 7.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm0 10.8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm10.8 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
    </svg>
  );
}
