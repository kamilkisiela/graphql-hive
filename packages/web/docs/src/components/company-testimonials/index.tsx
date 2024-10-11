import React, { Fragment, useRef } from 'react';
import Head from 'next/head';
import Image, { StaticImageData } from 'next/image';
import * as Tabs from '@radix-ui/react-tabs';
import { CallToAction, Heading } from '@theguild/components';
import { cn } from '../../lib';
import { ArrowIcon } from '../arrow-icon';
import { KarrotLogo, NacelleLogo, WealthsimpleLogo, type LogoProps } from '../company-logos';
import karrotPicture from './karrot-picture.webp';
import nacellePicture from './nacelle-picture.webp';
import wealthsimplePicture from './wealthsimple-picture.webp';

type Testimonial = {
  company: string;
  logo: (props: LogoProps) => React.ReactElement;
  text: string;
  picture?: {
    img: string | StaticImageData;
    className?: string;
  };
  person?: { name: string; title: string; image?: string };
  data?: Array<{ numbers: string; description: string }>;
  caseStudyHref?: string;
};

const testimonials: Testimonial[] = [
  {
    company: 'nacelle',
    logo: NacelleLogo,
    text: "Our migration from Apollo to Hive was incredibly straightforward. In less than a month, we had about 20 services running on Hive in production. The process was smooth, and the Hive team's friendly demeanor made it even more pleasant. Although we haven't needed direct assistance with our implementation, their openness to feedback and generally nice attitude has fostered a sense of collaboration and partnership.",
    picture: { img: nacellePicture },
    // data: [
    //   { numbers: '65M+', description: 'daily events processed' },
    //   { numbers: '40%', description: 'more resource efficient' },
    // ],
    // caseStudyHref: ""
  },
  {
    company: 'Karrot',
    logo: KarrotLogo,
    text: 'We use GraphQL Hive as schema registry and monitoring tool. As a schema registry, we can publish GraphQL Schema with decoupled any application code. As a monitoring tool, we can find useful metrics. For example operation latency, usage of deprecated field. The great thing about GraphQL Hive is that it is easy to use, we have already integrated many tools like Slack or Github.',
    picture: { img: karrotPicture },
  },
  {
    company: 'Wealthsimple',
    logo: props => (
      <WealthsimpleLogo
        {...props}
        height={26}
        className={cn('translate-y-[2px]', props.className)}
      />
    ),
    text: 'Hive enables Wealthsimple to build flexible and resilient GraphQL APIs. The GitHub integration provides feedback in a format developers are familiar with and conditional breaking changes enable us to focus our discussion on schema design rather than maintenance. Hive empowers us to confidently evolve our schemas by ensuring seamless API updates, detecting potential breaking changes, and guiding developers.',
    picture: {
      img: wealthsimplePicture,
    },
  },
];

export function CompanyTestimonialsSection({ className }: { className?: string }) {
  const tabsListRef = useRef<HTMLDivElement>(null);
  const scrollviewRef = React.useRef<HTMLDivElement>(null);
  const updateDotsOnScroll = useRef<(event: React.UIEvent) => void>();
  updateDotsOnScroll.current ||= debounce(() => {
    const scrollview = scrollviewRef.current;
    const tabsList = tabsListRef.current;
    if (!scrollview || !tabsList) return;
    const scrollLeft = scrollview.scrollLeft;
    const scrollWidth = scrollview.scrollWidth;
    const index = Math.round((scrollLeft / scrollWidth) * testimonials.length);

    const tabs = tabsList.querySelectorAll('[role="tab"]');
    for (const [i, tab] of tabs.entries()) {
      tab.setAttribute('data-state', i === index ? 'active' : 'inactive');
    }
  }, 50);

  return (
    <>
      <Head>
        {/* not preloading nacelle, because it's rendered from the get go, but below the fold */}
        <link rel="preload" href={karrotPicture.src} as="image" />
        <link rel="preload" href={wealthsimplePicture.src} as="image" />
      </Head>
      <section
        className={cn(
          'bg-beige-100 text-green-1000 relative overflow-hidden rounded-3xl px-4 py-6 md:p-10 lg:p-[72px]',
          className,
        )}
      >
        <Heading as="h2" size="md">
          Loved by developers, trusted by businesses
        </Heading>
        <Tabs.Root
          defaultValue={testimonials[0].company}
          className="flex flex-col"
          onValueChange={value => {
            const id = getTestimonialId(value);
            const element = document.getElementById(id);
            if (element) {
              element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
            }
          }}
        >
          <Tabs.List
            ref={tabsListRef}
            className="lg:bg-beige-200 z-10 order-1 mt-4 flex flex-row justify-center rounded-2xl lg:order-first lg:my-16"
          >
            {testimonials.map(testimonial => {
              const Logo = testimonial.logo;
              return (
                <Tabs.Trigger
                  key={testimonial.company}
                  value={testimonial.company}
                  className={
                    'hive-focus flex-grow-0 [&[data-state="active"]>:first-child]:bg-blue-400' +
                    ' lg:rdx-state-active:bg-white lg:flex-grow lg:bg-transparent' +
                    ' justify-center p-0.5 lg:p-4' +
                    ' rdx-state-active:text-green-1000 lg:rdx-state-active:border-beige-600' +
                    ' border-transparent font-medium leading-6 text-green-800 lg:border' +
                    ' flex flex-1 items-center justify-center rounded-[15px]'
                  }
                >
                  <div className="size-2 rounded-full bg-blue-200 transition-colors lg:hidden" />
                  <Logo title={testimonial.company} height={32} className="max-lg:sr-only" />
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>
          <div
            /* mobile scrollview */
            ref={scrollviewRef}
            className="-m-2 -mb-10 flex snap-x snap-mandatory gap-4 overflow-auto p-2 lg:pb-10"
            onScroll={updateDotsOnScroll.current}
          >
            {testimonials.map(
              ({ company, data, caseStudyHref, text, picture, person, logo: Logo }) => {
                return (
                  <Tabs.Content
                    key={company}
                    value={company}
                    tabIndex={-1}
                    className={cn(
                      'relative flex w-full shrink-0 snap-center flex-col' +
                        ' gap-6 md:flex-row lg:gap-12' +
                        ' lg:data-[state="inactive"]:hidden',
                      caseStudyHref
                        ? 'data-[state="active"]:pb-[72px] lg:data-[state="active"]:pb-0'
                        : 'max-lg:pb-8',
                    )}
                    forceMount // we mount everything, as we scroll through tabs on mobile
                  >
                    {picture && (
                      <Image
                        src={picture.img}
                        role="presentation"
                        alt=""
                        width={300}
                        height={300}
                        className={cn(
                          'hidden size-[300px] shrink-0 rounded-3xl object-cover mix-blend-multiply max-lg:mt-6 md:block',
                          picture.className,
                        )}
                      />
                    )}
                    <article className="max-lg:mt-6 lg:relative" id={getTestimonialId(company)}>
                      <Logo title={company} height={32} className="text-blue-1000 mb-6 lg:hidden" />
                      <blockquote className="sm:blockquote-beige-500 lg:text-xl xl:text-2xl xl:leading-[32px]">
                        {text}
                      </blockquote>
                      {person && <TestimonialPerson className="mt-6" person={person} />}
                      {caseStudyHref && (
                        <CallToAction
                          variant="primary"
                          href={caseStudyHref}
                          className="absolute bottom-0 w-full md:w-fit"
                        >
                          Read Case Study
                          <ArrowIcon />
                        </CallToAction>
                      )}
                    </article>
                    {data && (
                      <>
                        <div /* divider */ className="bg-beige-600 hidden w-px md:block" />
                        <ul className="flex gap-6 md:flex-col md:gap-12">
                          {data.map(({ numbers, description }, i) => (
                            <Fragment key={i}>
                              <li>
                                <span
                                  className={
                                    'block text-[40px] leading-[1.2] tracking-[-0.2px]' +
                                    ' md:text-6xl md:leading-[1.1875] md:tracking-[-0.64px]'
                                  }
                                >
                                  {numbers}
                                </span>
                                <span className="mt-2">{description}</span>
                              </li>

                              {i < data.length - 1 && (
                                <div /* divider */ className="bg-beige-600 w-px md:hidden" />
                              )}
                            </Fragment>
                          ))}
                        </ul>
                      </>
                    )}
                  </Tabs.Content>
                );
              },
            )}
          </div>
        </Tabs.Root>
      </section>
    </>
  );
}

function getTestimonialId(company: string) {
  return encodeURIComponent(company.toLowerCase()) + '-testimonial';
}

function TestimonialPerson({
  className,
  person,
}: {
  className?: string;
  person: Testimonial['person'];
}) {
  if (!person) return null;

  return (
    <div className={className}>
      {person.image && (
        <Image
          src={person.image}
          role="presentation"
          alt=""
          width={42}
          height={42}
          className="bg-beige-200 float-left mr-4 size-[42px] shrink-0 translate-y-[.5px] rounded-full xl:hidden"
        />
      )}
      <p className="text-sm font-medium leading-5">{person.name}</p>
      <p className="mt-1 text-xs text-green-800 md:text-sm">{person.title}</p>
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(fn: T, delay = 100) {
  let timeout: NodeJS.Timeout;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  } as T;
}
