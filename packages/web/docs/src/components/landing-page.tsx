import React, { ReactElement } from 'react';
import { FiGithub, FiGlobe, FiLogIn, FiPackage, FiServer, FiTruck } from 'react-icons/fi';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CallToAction } from './call-to-action';
import { CheckIcon } from './check-icon';
import { EcosystemManagementSection } from './ecosystem-management';
import { FeatureTabs } from './feature-tabs';
import { Heading } from './heading';
import { Hero, HeroFeatures, HeroLinks, TrustedBy } from './hero';
import { InfoCard } from './info-card';
import { AligentLogo, KarrotLogo, LinktreeLogo, MeetupLogo, SoundYXZLogo } from './logos';
import { Page } from './page';
import { Pricing } from './pricing';
import { StatsItem, StatsList } from './stats';

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
        <EnterpriseFocusedCards />
      </Page>
    </Tooltip.Provider>
  );
}

function EnterpriseFocusedCards() {
  return (
    <section className="bg-beige-100 rounded-3xl py-24 md:py-[120px]">
      <Heading as="h3" size="md" className="text-balance px-6 text-center">
        Enterprise-focused tooling at your disposal
      </Heading>
      <div className="-my-8 overflow-auto py-8">
        <ul className="mt-16 flex min-w-[900px] flex-row justify-center divide-x divide-solid md:px-6 lg:px-16">
          <InfoCard
            as="li"
            heading="Cloud and Self-Hosted"
            icon={<PerformanceListItemIcon />}
            className="flex-1 px-8 py-0"
          >
            Hive is completely open source, MIT licensed. You can host it on your own
            infrastructure!
          </InfoCard>
          <InfoCard
            as="li"
            heading="OIDC Login"
            icon={<PerformanceListItemIcon />}
            className="flex-1 px-8 py-0"
          >
            Integrated with popular providers like OKTA, to enable OpenID Connect login for maximum
            security.
          </InfoCard>
          <InfoCard
            as="li"
            heading="Secure and efficient"
            icon={<PerformanceListItemIcon />}
            className="flex-1 px-8 py-0"
          >
            <a
              href="https://the-guild.dev/graphql/hive/docs/features/app-deployments#publish-an-app-deployment"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Persisted Documents
            </a>{' '}
            secure and reduce traffic by hashing operations on app deployments.
          </InfoCard>
        </ul>
      </div>
    </section>
  );
}

function UltimatePerformanceCards() {
  return (
    <section className="px-6 py-12 sm:py-24">
      <Heading as="h3" size="md" className="text-center">
        GraphQL for the ultimate performance
      </Heading>
      <ul className="mt-16 flex flex-row flex-wrap justify-center gap-2 md:gap-6">
        <InfoCard
          as="li"
          heading="Deliver improvements faster"
          icon={<PerformanceListItemIcon />}
          className="flex-1"
        >
          Accelerate feature improvements and experiments, by seamless decoupling of backend and
          frontend environments.
        </InfoCard>
        <InfoCard
          as="li"
          heading="Network efficiency"
          icon={<PerformanceListItemIcon />}
          className="flex-1"
        >
          Accelerate feature improvements and experiments, by seamless decoupling of backend and
          frontend environments.
        </InfoCard>
        <InfoCard
          as="li"
          heading="Optimized data retrieval"
          icon={<PerformanceListItemIcon />}
          className="flex-1 basis-full lg:basis-0"
        >
          Reduce latency effectively with Hive by enabling frontend teams to obtain all required
          data in a single request, maximizing GraphQL’s inherent performance benefits.
        </InfoCard>
      </ul>
    </section>
  );
}

function PerformanceListItemIcon() {
  return (
    <svg width="24" height="24" fill="currentColor">
      <path d="M5.25 7.5a2.25 2.25 0 1 1 3 2.122v4.756a2.251 2.251 0 1 1-1.5 0V9.622A2.25 2.25 0 0 1 5.25 7.5Zm9.22-2.03a.75.75 0 0 1 1.06 0l.97.97.97-.97a.75.75 0 1 1 1.06 1.06l-.97.97.97.97a.75.75 0 0 1-1.06 1.06l-.97-.97-.97.97a.75.75 0 1 1-1.06-1.06l.97-.97-.97-.97a.75.75 0 0 1 0-1.06Zm2.03 5.03a.75.75 0 0 1 .75.75v3.128a2.251 2.251 0 1 1-1.5 0V11.25a.75.75 0 0 1 .75-.75Z" />
    </svg>
  );
}
