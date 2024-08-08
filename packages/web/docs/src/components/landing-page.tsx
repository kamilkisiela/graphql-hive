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
        <FeatureTabs className="relative mt-[-72px]" />
        <TrustedBy className="mx-auto my-8 md:my-16 lg:my-24">
          <MeetupLogo title="Meetup" height={32} className="translate-y-[5px]" />
          <LinktreeLogo title="Linktree" height={22} />
          <KarrotLogo title="Karrot" height={28} />
          <AligentLogo title="Aligent" height={32} />
          <SoundYXZLogo title="SoundXYZ" height={32} />
        </TrustedBy>
        <EcosystemManagementSection />
        <div className="relative even:bg-gray-50">
          <StatsList>
            <StatsItem label="GitHub commits" value={6.2} suffix="K" decimal />
            <StatsItem label="Active developers" value={5.7} suffix="K" decimal />
            <StatsItem label="Registered schemas" value={225} suffix="K" />
            <StatsItem label="Collected operations" value={315} suffix="B" />
          </StatsList>
        </div>
        <Pricing />
      </Page>
    </Tooltip.Provider>
  );
}
