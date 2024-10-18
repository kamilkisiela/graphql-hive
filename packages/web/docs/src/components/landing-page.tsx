import { ReactElement, useEffect, useLayoutEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  ArchDecoration,
  CallToAction,
  DecorationIsolation,
  GetYourAPIGameRightSection,
  Heading,
  HighlightDecoration,
  LargeHiveIconDecoration,
  ToolsAndLibrariesCards,
} from '@theguild/components';
import { cn } from '../lib';
import { CheckIcon } from './check-icon';
import { CommunitySection } from './community-section';
import { AligentLogo, KarrotLogo, LinktreeLogo, MeetupLogo, SoundYXZLogo } from './company-logos';
import { CompanyTestimonialsSection } from './company-testimonials';
import { EcosystemManagementSection } from './ecosystem-management';
import { FeatureTabs } from './feature-tabs';
import { FrequentlyAskedQuestions } from './frequently-asked-questions';
import { Hero, HeroFeatures, HeroLinks, TrustedBy } from './hero';
import { InfoCard } from './info-card';
import { Page } from './page';
import { Pricing } from './pricing';
import { StatsItem, StatsList } from './stats';
import { TeamSection } from './team-section';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function IndexPage(): ReactElement {
  useIsomorphicLayoutEffect(() => {
    // We add .light class to body to style the Headless UI
    // portal containing search results.
    document.body.classList.add('light');

    return () => {
      document.body.classList.remove('light');
    };
  }, []);

  return (
    <Tooltip.Provider>
      <style global jsx>
        {`
          html {
            scroll-behavior: smooth;
          }
          body {
            background: #fff;
            --nextra-primary-hue: 191deg;
            --nextra-primary-saturation: 40%;
            --nextra-bg: 255, 255, 255;
          }
        `}
      </style>
      <Page className="text-green-1000 light mx-auto max-w-[90rem] overflow-hidden">
        <Hero className="mx-4 max-sm:mt-2 md:mx-6">
          <Heading
            as="h1"
            size="xl"
            className="mx-auto max-w-3xl text-balance text-center text-white"
          >
            Open-source GraphQL platform
          </Heading>
          <p className="mx-auto w-[512px] max-w-[80%] text-center leading-6 text-white/80">
            Schema registry, analytics and gateway for GraphQL federation and other GraphQL APIs.
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
              Documentation
            </CallToAction>
          </HeroLinks>
        </Hero>
        <FeatureTabs className="relative mt-6 sm:mt-[-72px]" />
        <TrustedBy className="mx-auto my-8 md:my-16 lg:my-24">
          <MeetupLogo title="Meetup" height={32} className="translate-y-[5px]" />
          <LinktreeLogo title="Linktree" height={22} />
          <KarrotLogo title="Karrot" height={28} />
          <AligentLogo title="Aligent" height={32} />
          <SoundYXZLogo title="SoundXYZ" height={32} />
        </TrustedBy>
        <EcosystemManagementSection className="mx-4 md:mx-6" />
        <StatsList className="mt-6 md:mt-0">
          <StatsItem label="GitHub commits" value={6.2} suffix="K" decimal />
          <StatsItem label="Active developers" value={6.2} suffix="K" decimal />
          <StatsItem label="Registered schemas" value={270} suffix="K" />
          <StatsItem label="Collected operations" value={350} suffix="B" />
        </StatsList>
        <UltimatePerformanceCards />
        <CompanyTestimonialsSection className="mx-4 mt-6 md:mx-6" />
        <GetStartedTodaySection className="mx-4 mt-6 md:mx-6" />
        <EnterpriseFocusedCards className="mx-4 mt-6 md:mx-6" />
        <Pricing />
        <TeamSection className="mx-4 md:mx-6" />
        <CommunitySection className="mx-4 mt-6 md:mx-6" />
        <ToolsAndLibrariesCards className="mx-4 mt-6 md:mx-6" />
        <FrequentlyAskedQuestions className="mx-4 md:mx-6" />
        <GetYourAPIGameRightSection className="mx-4 sm:mb-6 md:mx-6" />
      </Page>
    </Tooltip.Provider>
  );
}

function GetStartedTodaySection({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl bg-[#003834] p-12 text-center sm:p-24',
        className,
      )}
    >
      <DecorationIsolation>
        <ArchDecoration className="absolute -left-1/2 -top-1/2 rotate-180 sm:-left-1/4 md:left-[-105px] md:top-[-109px] [&>path]:fill-none" />
        <HighlightDecoration className="absolute -left-1 -top-16 size-[600px] -scale-x-100 overflow-visible" />
        <LargeHiveIconDecoration className="absolute bottom-0 right-8 hidden lg:block" />
      </DecorationIsolation>
      <Heading as="h3" size="md" className="text-white">
        Get started today!
      </Heading>
      <p className="relative mt-4 text-white/80">
        Start with a free Hobby plan that fits perfectly most side projects or try our Pro plan with
        30&nbsp;days trial period.
      </p>
      <CallToAction
        variant="primary-inverted"
        className="mx-auto mt-8"
        href="https://app.graphql-hive.com/"
      >
        Enter Hive
      </CallToAction>
    </section>
  );
}

function EnterpriseFocusedCards({ className }: { className?: string }) {
  return (
    <section
      className={cn('bg-beige-100 rounded-3xl px-4 pt-6 sm:py-24 md:px-6 md:py-[120px]', className)}
    >
      <Heading as="h3" size="md" className="text-balance sm:px-6 sm:text-center">
        Enterprise-focused tools tailored for you
      </Heading>
      <ul className="flex flex-row flex-wrap justify-center divide-y divide-solid sm:mt-6 sm:divide-x sm:divide-y-0 md:mt-16 md:px-6 xl:px-16">
        <InfoCard
          as="li"
          heading="Cloud and Self-Hosted"
          icon={<PerformanceListItemIcon />}
          className="flex-1 px-0 sm:px-8 sm:py-0 md:px-8 md:py-0"
        >
          Hive is completely open source, MIT licensed. You can host it on your own infrastructure.
        </InfoCard>
        <InfoCard
          as="li"
          heading="Single Sign-On"
          icon={<PerformanceListItemIcon />}
          className="flex-1 basis-full px-0 sm:basis-0 sm:px-8 sm:py-0 md:px-8 md:py-0"
        >
          Integrated with popular providers like Okta, to enable OpenID Connect login for maximum
          security.
        </InfoCard>
        <InfoCard
          as="li"
          heading="Customizable User Roles and Permissions"
          icon={<PerformanceListItemIcon />}
          className="flex-1 px-0 sm:px-8 sm:py-0 md:px-8 md:py-0"
        >
          Control user access with detailed, role-based permissions for enhanced security and
          flexibility.
        </InfoCard>
      </ul>
    </section>
  );
}

function UltimatePerformanceCards() {
  return (
    <section className="px-4 py-6 sm:py-12 md:px-6 xl:px-[120px]">
      <Heading as="h3" size="md" className="text-balance text-center">
        GraphQL for the ultimate performance
      </Heading>
      <ul className="mt-6 flex flex-row flex-wrap justify-center gap-2 md:mt-16 md:gap-6">
        <InfoCard
          as="li"
          heading="Deliver improvements faster"
          icon={<PerformanceListItemIcon />}
          className="flex-1 rounded-2xl md:rounded-3xl"
        >
          Accelerate feature improvements and experiments, by seamless decoupling of backend and
          frontend environments.
        </InfoCard>
        <InfoCard
          as="li"
          heading="Network efficiency"
          icon={<PerformanceListItemIcon />}
          className="flex-1 basis-full rounded-2xl md:basis-0 md:rounded-3xl"
        >
          Minimize unnecessary network calls that hinder your application's speed. Use GraphQL to
          enhance responsiveness and scales these benefits across your enterprise.
        </InfoCard>
        <InfoCard
          as="li"
          heading="Optimized data retrieval"
          icon={<PerformanceListItemIcon />}
          className="flex-1 basis-full rounded-2xl md:rounded-3xl lg:basis-0"
        >
          Streamline communication between frontend and backend by enabling precise data selection,
          reducing unnecessary payloads and simplifying API interactions.
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
