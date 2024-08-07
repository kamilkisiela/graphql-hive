import { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { FiGithub, FiGlobe, FiLogIn, FiPackage, FiServer, FiTruck } from 'react-icons/fi';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../lib';
import { CallToAction } from './call-to-action';
import { CheckIcon } from './check-icon';
import { EcosystemManagementSection } from './ecosystem-management';
import { FeatureTabs } from './feature-tabs';
import { Heading } from './heading';
import { Hero, HeroFeatures, HeroLinks, TrustedBy } from './hero';
import { Highlights, HighlightTextLink } from './highlights';
import { AligentLogo, KarrotLogo, LinktreeLogo, MeetupLogo, SoundYXZLogo } from './logos';
import { Page } from './page';
import { Pricing } from './pricing';
import { StatsItem, StatsList } from './stats';

const renderFeatures = ({
  title,
  description,
  documentationLink,
}: {
  title: string;
  description: ReactNode;
  documentationLink?: string;
}) => (
  <div className="flex flex-1 flex-row gap-6 md:flex-col lg:flex-row" key={title}>
    <div className="flex flex-col text-black">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
      {documentationLink ? (
        <Link
          href={documentationLink}
          className="group mt-2 inline-flex items-center gap-x-2 text-sm underline-offset-8 transition hover:underline"
        >
          <div>Learn more</div>
        </Link>
      ) : null}
    </div>
  </div>
);

export function IndexPage(): ReactElement {
  return (
    <Tooltip.Provider>
      <Page className="mx-auto max-w-[90rem] bg-white">
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
        <FeatureTabs className="relative mt-[-68px]" />
        <TrustedBy className="mg:my-16 mx-auto my-8 lg:my-24">
          <MeetupLogo title="Meetup" height={32} className="translate-y-[5px]" />
          <LinktreeLogo title="Linktree" height={22} />
          <KarrotLogo title="Karrot" height={28} />
          <AligentLogo title="Aligent" height={32} />
          <SoundYXZLogo title="SoundXYZ" height={32} />
        </TrustedBy>
        <EcosystemManagementSection />
        <div className="relative even:bg-gray-50">
          <StatsList>
            <StatsItem label="Happy users" value={5.7} suffix="K" decimal />
            <StatsItem label="Registered Schemas" value={225} suffix="K" />
            <StatsItem label="Collected Operations" value={315} suffix="B" />
            <StatsItem label="GitHub Commits" value={6.2} suffix="K" decimal />
          </StatsList>
        </div>
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

          <div className="relative overflow-hidden">
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
              <div className="absolute top-0 h-px w-full opacity-25" />
              <div className="absolute left-[-200px] top-[-200px] h-[255px] w-[60vw] opacity-15 blur-3xl" />
              <div className="absolute right-[-200px] top-[-200px] h-[255px] w-[60vw] opacity-15 blur-3xl" />
            </div>
            <div className="py-24">
              <div className="container mx-auto box-border flex flex-col gap-y-24 px-6">
                <div className="text-center">
                  <h2 className="mb-6 bg-clip-text text-5xl font-semibold leading-normal text-transparent">
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
        <Pricing />
      </Page>
    </Tooltip.Provider>
  );
}
