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
import { AligentLogo, KarrotLogo, LinktreeLogo, MeetupLogo, SoundYXZLogo } from './logos';
import { Page } from './page';
import { Pricing } from './pricing';
import { StatsItem, StatsList } from './stats';
import { Stud } from './stud';

export function IndexPage(): ReactElement {
  return (
    <Tooltip.Provider>
      <style global jsx>
        {`
          body {
            background: #fff;
          }
        `}
      </style>
      <Page className="text-green-1000 mx-auto max-w-[90rem]">
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
        <FeatureTabs className="relative mt-[-72px]" />
        <TrustedBy className="mx-auto my-8 md:my-16 lg:my-24">
          <MeetupLogo title="Meetup" height={32} className="translate-y-[5px]" />
          <LinktreeLogo title="Linktree" height={22} />
          <KarrotLogo title="Karrot" height={28} />
          <AligentLogo title="Aligent" height={32} />
          <SoundYXZLogo title="SoundXYZ" height={32} />
        </TrustedBy>
        <EcosystemManagementSection />
        <StatsList>
          <StatsItem label="GitHub commits" value={6.2} suffix="K" decimal />
          <StatsItem label="Active developers" value={5.7} suffix="K" decimal />
          <StatsItem label="Registered schemas" value={225} suffix="K" />
          <StatsItem label="Collected operations" value={315} suffix="B" />
        </StatsList>
        <UltimatePerformanceCards />
        <Pricing />
      </Page>
    </Tooltip.Provider>
  );
}

function UltimatePerformanceCards() {
  return (
    <section className="px-6 py-12 sm:py-24">
      <Heading as="h3" size="md" className="text-center">
        GraphQL for the ultimate performance
      </Heading>
      <ul className="mt-16 flex flex-row flex-wrap justify-center gap-2 md:gap-6">
        <li className="bg-beige-100 flex-1 p-12">
          <Stud>
            <PerformanceListItemIcon />
          </Stud>
          <h3 className="text-green-1000 mt-6 text-xl font-medium leading-[1.4]">
            Deliver improvements faster
          </h3>
          <p className="mt-4 text-green-800">
            Accelerate feature improvements and experiments, by seamless decoupling of backend and
            frontend environments.
          </p>
        </li>
        <li className="bg-beige-100 flex-1 p-12">
          <Stud>
            <PerformanceListItemIcon />
          </Stud>
          <h3 className="text-green-1000 mt-6 text-xl font-medium leading-[1.4]">
            Network efficiency
          </h3>
          <p className="mt-4 text-green-800">
            Accelerate feature improvements and experiments, by seamless decoupling of backend and
            frontend environments.
          </p>
        </li>
        <li className="bg-beige-100 flex-1 basis-full p-12 lg:basis-0">
          <Stud>
            <PerformanceListItemIcon />
          </Stud>
          <h3 className="text-green-1000 mt-6 text-xl font-medium leading-[1.4]">
            Optimized data retrieval
          </h3>
          <p className="mt-4 text-green-800">
            Reduce latency effectively with Hive by enabling frontend teams to obtain all required
            data in a single request, maximizing GraphQL’s inherent performance benefits.
          </p>
        </li>
      </ul>
    </section>
  );
}

function PerformanceListItemIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M7.761 9.111a2.701 2.701 0 0 0 2.606 1.989h3.6a4.5 4.5 0 0 1 4.434 3.731 2.7 2.7 0 1 1-3.489 3.075 2.7 2.7 0 0 1 1.66-3.017 2.702 2.702 0 0 0-2.605-1.989h-3.6a4.48 4.48 0 0 1-2.7-.9v2.853a2.701 2.701 0 1 1-1.8 0V9.147a2.7 2.7 0 1 1 1.894-.036ZM6.767 7.5a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm0 10.8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm10.8 0a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
    </svg>
  );
}
