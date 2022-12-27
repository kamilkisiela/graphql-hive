import { ReactElement, useState, useCallback, ReactNode } from 'react';
import { useMounted } from '@theguild/components';
import * as Tooltip from '@radix-ui/react-tooltip';
import clsx from 'clsx';
import { FiServer, FiGlobe, FiRadio, FiGithub } from 'react-icons/fi';
import { Pricing } from '../pricing';
import schemaHistoryImage from '../../public/features/schema-history.png';
import monitoringImage from '../../public/features/monitoring-preview.png';
import cicdImage from '../../public/any-ci-cd.svg';
import Image, { StaticImageData } from 'next/image';

const classes = {
  link: clsx(
    'inline-block bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-3 rounded-lg font-medium shadow-sm',
    'dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
  ),
  feature: clsx(
    'w-full py-24',
    'odd:bg-gray-50 odd:dark:bg-gray-900',
    'even:bg-white even:dark:bg-black',
  ),
  root: clsx('flex flex-row md:flex-col lg:flex-row flex-1 gap-6'),
  content: clsx('flex flex-col text-black dark:text-white'),
  title: clsx('text-xl font-semibold'),
  description: clsx('text-gray-600 dark:text-gray-400'),
};

const CookiesConsent = (): ReactElement => {
  const [show, setShow] = useState(() => localStorage.getItem('cookies') !== 'true');

  const accept = useCallback(() => {
    setShow(false);
    localStorage.setItem('cookies', 'true');
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-0 flex w-full flex-wrap items-center justify-center gap-4 bg-gray-100 px-5 py-7 text-center lg:flex-nowrap lg:justify-between lg:text-left">
      <div className="text-dark w-full text-sm">
        <p>This website uses cookies to analyze site usage and improve your experience.</p>
        <p>If you continue to use our services, you are agreeing to the use of such cookies.</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-4 lg:pr-24">
        <a
          href="https://the-guild.dev/graphql/hive/privacy-policy.pdf"
          className="whitespace-nowrap text-yellow-600 hover:underline"
        >
          Privacy Policy
        </a>
        <button
          className="rounded-md bg-yellow-500 px-5 py-2 text-white hover:bg-yellow-700 focus:outline-none"
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

const renderFeatures = ({ title, description }) => (
  <div className={classes.root} key={title}>
    <div className={classes.content}>
      <h3 className={clsx(classes.title, 'text-lg')}>{title}</h3>
      <p className={clsx(classes.description, 'text-sm')}>{description}</p>
    </div>
  </div>
);

function Hero() {
  return (
    <div className="w-full">
      <div className="my-6 py-20 px-2 sm:py-24 lg:py-32">
        <h1 className="mx-auto max-w-screen-md bg-gradient-to-r from-yellow-500 to-orange-600 bg-clip-text text-center text-5xl font-extrabold text-transparent dark:from-yellow-400 dark:to-orange-500 sm:text-5xl lg:text-6xl">
          Take full control of your GraphQL API
        </h1>
        <p className="mx-auto mt-6 max-w-screen-sm text-center text-2xl text-gray-600 dark:text-gray-400">
          Prevent breaking changes, monitor performance of your GraphQL API, and manage your API
          gateway
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://app.graphql-hive.com"
            className={clsx(
              'inline-block rounded-lg bg-yellow-500 px-6 py-3 font-medium text-white shadow-sm hover:bg-opacity-75',
              'dark:bg-yellow-600 dark:hover:bg-yellow-500 dark:hover:bg-opacity-100',
            )}
          >
            Sign up for free
          </a>
          <a href="https://docs.graphql-hive.com" className={classes.link}>
            Documentation
          </a>
          <a
            className={clsx(classes.link, 'flex flex-row items-center gap-2')}
            href="https://github.com/kamilkisiela/graphql-hive"
          >
            <FiGithub /> GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

function Feature(props: {
  title: string;
  description: ReactNode;
  highlights?: {
    title: string;
    description: ReactNode;
    icon?: ReactNode;
  }[];
  image: StaticImageData;
  gradient: number;
  flipped?: boolean;
}) {
  const { title, description, highlights, image, gradient, flipped } = props;
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
          <div className="flex w-full flex-shrink-0 flex-col gap-4 md:w-2/5 lg:w-1/3">
            <h2
              className="bg-clip-text text-5xl font-semibold leading-normal text-transparent dark:text-transparent"
              style={{ backgroundImage: `linear-gradient(-70deg, ${end}, ${start})` }}
            >
              {title}
            </h2>
            <div className="text-lg leading-7 text-gray-600 dark:text-gray-400">{description}</div>
          </div>
          <div
            className="relative flex flex-grow flex-col items-center justify-center overflow-hidden rounded-3xl p-8"
            style={{ backgroundImage: `linear-gradient(70deg, ${start}, ${end})` }}
          >
            <Image {...image} className="rounded-2xl" alt={title} />
          </div>
        </div>
        {Array.isArray(highlights) && highlights.length > 0 && (
          <div className="flex flex-col justify-between gap-12 md:flex-row">
            {highlights.map(({ title, description, icon }) => (
              <div className={classes.root} key={title}>
                <div className="h-16 w-16 flex-shrink-0 text-yellow-500">{icon}</div>
                <div className={classes.content}>
                  <h3 className={classes.title}>{title}</h3>
                  <p className={classes.description}>{description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IndexPage(): ReactElement {
  const mounted = useMounted();
  return (
    <Tooltip.Provider>
      <div className="flex h-full flex-col">
        <Hero />
        <div className="flex flex-col">
          <Feature
            title="Schema Registry"
            description={
              <div className="space-y-2">
                <p>Push GraphQL schema to the registry and track the history of changes.</p>
                <p>All your GraphQL services in one place.</p>
              </div>
            }
            highlights={[
              {
                title: 'Manage your Gateway',
                description: 'Connect to Apollo Federation, GraphQL Mesh, Stitching and more.',
                icon: <FiServer className="h-full w-full" />,
              },
              {
                title: 'Global Edge Network',
                description: 'Access the registry from any place on earth within milliseconds.',
                icon: <FiGlobe className="h-full w-full" />,
              },
              {
                title: 'Make it smarter',
                description: 'Detect unused parts of Schema thanks to GraphQL analytics.',
                icon: <FiRadio className="h-full w-full" />,
              },
            ]}
            image={schemaHistoryImage}
            gradient={0}
          />
          <Feature
            title="Monitoring"
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
                      description: 'Get a global overview of the usage of your GraphQL API.',
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
            title="Analytics"
            description={
              <div className="flex flex-col gap-y-12">
                <div>
                  <p>Maintain your GraphQL API across many teams without concerns.</p>
                </div>
                <div className="flex flex-col gap-y-12">
                  {[
                    {
                      title: 'Prevent Breaking Changes',
                      description:
                        'Combination of Schema Registry and GraphQL Monitoring helps you evolve your GraphQL API.',
                    },
                    {
                      title: 'Detect unused fields',
                      description:
                        'Helps you understand the coverage of GraphQL schema and safely remove the unused part.',
                    },
                    {
                      title: 'Alerts and notifications',
                      description: 'Stay on top of everything with Slack notifications.',
                    },
                  ].map(renderFeatures)}
                </div>
              </div>
            }
            image={cicdImage}
            gradient={2}
          />
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
      </div>
      {mounted && <CookiesConsent />}
    </Tooltip.Provider>
  );
}
