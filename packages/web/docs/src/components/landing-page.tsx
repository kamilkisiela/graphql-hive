import { ReactElement, ReactNode } from 'react';
import Image, { StaticImageData } from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { FiGithub, FiGlobe, FiPackage, FiServer, FiTruck } from 'react-icons/fi';
import * as Tooltip from '@radix-ui/react-tooltip';
import { BookIcon } from './book-icon';
import { Hero, HeroLinks, HeroSubtitle, HeroTitle } from './hero';
import { Highlights, HighlightTextLink } from './highlights';
import { Page } from './page';
import { Pricing } from './pricing';
import { StatsItem, StatsList } from './stats';
import monitoringImage from '../../public/features/new/monitoring-preview.png';
import schemaHistoryImage from '../../public/features/new/schema-history.png';

const classes = {
  link: clsx(
    'inline-block rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-600 shadow-sm hover:bg-gray-200',
    'dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
  ),
  feature: clsx(
    'w-full py-24 ',
    'even:bg-gray-50 even:dark:bg-gray-900',
    'odd:bg-white odd:dark:bg-black',
  ),
  root: clsx('flex flex-1 flex-row gap-6 md:flex-col lg:flex-row'),
  content: clsx('flex flex-col text-black dark:text-white'),
  title: clsx('text-xl font-semibold'),
  description: clsx('text-gray-600 dark:text-gray-400'),
};

const gradients: [string, string][] = [
  ['#ff9472', '#f2709c'],
  ['#4776e6', '#8e54e9'],
  ['#f857a6', '#ff5858'],
  ['#4ac29a', '#bdfff3'],
  ['#00c6ff', '#0072ff'],
];

function pickGradient(i: number): [string, string] {
  const gradient = gradients[i % gradients.length];

  if (!gradient) {
    throw new Error('No gradient found');
  }

  return gradient;
}

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
      <h3 className={clsx(classes.title, 'text-lg')}>{title}</h3>
      <p className={clsx(classes.description, 'text-sm')}>{description}</p>
      {documentationLink ? (
        <Link
          href={documentationLink}
          className="group inline-flex text-sm items-center transition hover:underline underline-offset-8 gap-x-2 mt-2"
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
  title: string;
  description: ReactNode;
  image?: StaticImageData;
  highlights?: { title: string; description: string; documentationLink?: string }[];
  gradient: number;
  documentationLink?: string;
  flipped?: boolean;
}) {
  const { title, description, image, gradient, flipped, documentationLink, highlights } = props;
  const [start, end] = pickGradient(gradient);

  return (
    <div className={classes.feature}>
      <div className="container mx-auto box-border flex flex-col gap-y-24 px-6">
        <div
          className={clsx(
            'flex flex-col items-start gap-24 md:gap-12 lg:gap-24',
            flipped ? 'md:flex-row-reverse' : 'md:flex-row',
          )}
        >
          <div className="flex w-full shrink-0 flex-col gap-4 md:w-2/5 lg:w-1/3">
            <h2
              className="bg-clip-text text-4xl font-semibold leading-normal text-transparent dark:text-transparent"
              style={{ backgroundImage: `linear-gradient(-70deg, ${end}, ${start})` }}
            >
              {title}
            </h2>
            <div className="text-lg leading-7 text-gray-600 dark:text-gray-400">{description}</div>
            {documentationLink ? (
              <div className="pt-12">
                <Link
                  href={documentationLink}
                  className="group inline-flex font-semibold items-center transition hover:underline underline-offset-8 gap-x-2"
                  style={{
                    color: start,
                  }}
                >
                  <div>
                    <BookIcon size={16} />
                  </div>
                  <div>Learn more</div>
                </Link>
              </div>
            ) : null}
          </div>

          {highlights ? (
            <div className="flex grow flex-col items-center justify-center overflow-hidden rounded-3xl p-4">
              <div className="flex flex-col gap-y-12">{highlights.map(renderFeatures)}</div>
            </div>
          ) : null}

          {image ? (
            <div
              className="relative flex grow flex-col items-center justify-center overflow-hidden rounded-3xl p-4"
              style={{ backgroundImage: `linear-gradient(70deg, ${start}, ${end})` }}
            >
              <Image {...image} className="rounded-2xl" alt={title} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function IndexPage(): ReactElement {
  return (
    <Tooltip.Provider>
      <Page>
        <Hero>
          <HeroTitle>Full Control Over GraphQL</HeroTitle>
          <HeroSubtitle>
            Prevent breaking changes, monitor performance of your GraphQL API, and manage your API
            gateway
          </HeroSubtitle>
          <HeroLinks>
            <>
              <a
                href="https://app.graphql-hive.com"
                className={clsx(
                  'inline-block rounded-lg px-6 py-3 font-medium text-white shadow-sm',
                  'bg-yellow-500 hover:bg-yellow-500/75',
                  'dark:bg-yellow-600 dark:hover:bg-yellow-500/100',
                )}
              >
                Start for free
              </a>
              <Link href="/docs" className={classes.link}>
                Documentation
              </Link>
              <a
                className={clsx(classes.link, 'flex flex-row items-center gap-2')}
                href="https://github.com/kamilkisiela/graphql-hive"
              >
                <FiGithub /> Star on GitHub
              </a>
            </>
          </HeroLinks>
        </Hero>
        <div className="even:bg-gray-50 even:dark:bg-gray-900">
          <StatsList>
            <StatsItem label="Happy users" value={2.9} suffix="K" decimal />
            <StatsItem label="Registered Schemas" value={120} suffix="K" />
            <StatsItem label="Collected Operations" value={150} suffix="B" />
            <StatsItem label="GitHub Commits" value={2.2} suffix="K" decimal />
          </StatsList>
        </div>
        <div className="flex flex-col">
          <Feature
            title="Schema Registry"
            documentationLink="/docs/features/schema-registry"
            description={
              <div className="flex flex-col gap-y-24">
                <div>
                  <p>Push GraphQL schema to the registry and track the history of changes.</p>
                  <p>All your GraphQL services in one place.</p>
                </div>
                <div className="flex flex-col gap-y-12">
                  {[
                    {
                      title: 'Version control system for GraphQL',
                      description:
                        'Track every modification of your GraphQL API across different environments, such as staging and production.',
                    },
                    {
                      title: 'Schema checks',
                      description:
                        'Detect breaking changes and composition errors, prevent them from being deployed.',
                    },
                    {
                      title: 'Schema Explorer',
                      description:
                        'Navigate through your GraphQL schema and understand which types and fields are referenced from which subgraphs.',
                    },
                  ].map(renderFeatures)}
                </div>
              </div>
            }
            image={schemaHistoryImage}
            gradient={0}
          />
          <div className="even:bg-gray-50 even:dark:bg-gray-900">
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
                  icon: <FiServer className="h-full w-full" />,
                  documentationLink: '/docs/get-started/apollo-federation',
                },
                {
                  title: 'Global Edge Network',
                  description: 'Access the registry from any place on earth within milliseconds.',
                  icon: <FiGlobe className="h-full w-full" />,
                  documentationLink: '/docs/features/high-availability-cdn',
                },
                {
                  title: 'Apollo GraphOS alternative',
                  description: 'GraphQL Hive is a drop-in replacement for Apollo GraphOS.',
                  icon: <FiPackage className="h-full w-full" />,
                  documentationLink: '/docs/get-started/apollo-federation',
                },
              ]}
            />
          </div>
          <Feature
            title="GraphQL Monitoring"
            documentationLink="/docs/features/usage-reporting"
            description={
              <div className="flex flex-col gap-y-24">
                <div>
                  <p>
                    Be aware of how your GraphQL API is used and what is the experience of its final
                    users.
                  </p>
                </div>
                <div className="flex flex-col gap-y-12">
                  {[
                    {
                      title: 'GraphQL Consumers',
                      description:
                        'Track every source of GraphQL requests and see how the API is consumed.',
                    },
                    {
                      title: 'Overall performance',
                      description: 'Get a global overview of the usage of GraphQL API.',
                    },
                    {
                      title: 'Query performance',
                      description: 'Detect slow GraphQL Operations and identify the culprits.',
                    },
                  ].map(renderFeatures)}
                </div>
              </div>
            }
            image={monitoringImage}
            gradient={1}
            flipped
          />
          <Feature
            title="Schema Management"
            description={
              <div className="flex flex-col gap-y-12">
                <div>
                  <p>Maintain GraphQL API across many teams without concerns.</p>
                </div>
              </div>
            }
            gradient={2}
            highlights={[
              {
                title: 'Prevent Breaking Changes',
                description:
                  'Combination of Schema Registry and GraphQL Monitoring helps you evolve GraphQL API with confidence.',
                documentationLink: '/docs/management/targets#conditional-breaking-changes',
              },
              {
                title: 'Detect unused fields',
                description:
                  'Helps you understand the coverage of GraphQL schema and safely remove the unused part.',
                documentationLink: '/docs/features/usage-reporting',
              },
              {
                title: 'Schema Policy',
                description:
                  'Lint, verify, and enforce best practices across the entire federated graph.',
                documentationLink: '/docs/features/schema-policy',
              },
            ]}
          />
          <div className="even:bg-gray-50 even:dark:bg-gray-900">
            <Highlights
              items={[
                {
                  title: 'GitHub Integration',
                  description: 'Our CLI integrates smoothly with GitHub Actions / repositories.',
                  icon: <FiGithub className="h-full w-full" />,
                  documentationLink: '/docs/integrations/ci-cd#github-check-suites',
                },
                {
                  title: 'Works with every CI/CD',
                  description: 'Connect GraphQL Hive CLI to CI/CD of your choice.',
                  icon: <FiTruck className="h-full w-full" />,
                  documentationLink: '/docs/integrations/ci-cd',
                },
                {
                  title: 'On-premise or Cloud',
                  description:
                    'GraphQL Hive is MIT licensed, you can host it on your own infrastructure.',
                  icon: <FiServer className="h-full w-full" />,
                  documentationLink: '/docs/self-hosting/get-started',
                },
              ]}
            />
          </div>
          <div className={classes.feature}>
            <div className="container mx-auto box-border flex flex-col gap-y-24 px-6">
              <div className="text-center">
                <h2
                  className="mb-6 bg-clip-text text-5xl font-semibold leading-normal text-transparent dark:text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(-70deg, ${gradients[3][1]}, ${gradients[3][0]})`,
                  }}
                >
                  Open-Source
                </h2>
                <p className="text-lg leading-7 text-gray-600 dark:text-gray-400">
                  Built entirely in public.
                </p>
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
        <Pricing gradient={gradients[4]} />
      </Page>
    </Tooltip.Provider>
  );
}
