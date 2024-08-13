import React, { Fragment, useRef } from 'react';
import Image from 'next/image';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '../lib';
import { ArrowIcon } from './arrow-icon';
import { CallToAction } from './call-to-action';
import { Heading } from './heading';
import { MeetupLogo, type LogoProps } from './logos';

type Testimonial = {
  company: string;
  logo: (props: LogoProps) => React.ReactElement;
  text: string;
  person: { name: string; title: string; image: string };
  data: Array<{ numbers: string; description: string }>;
  href: string;
};

const testimonials: Testimonial[] = [
  {
    company: 'Meetup',
    logo: MeetupLogo,
    text: 'Hive 1 offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: {
      name: 'Ryan Baldwin',
      title: 'Senior Backend Engineering Manager',
      image: 'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    },
    data: [
      { numbers: '65M+', description: 'daily events processed' },
      { numbers: '40%', description: 'more resource efficient' },
    ],
    href: '#TODO',
  },
  {
    company: 'Linktree',
    logo: MeetupLogo,
    text: 'Hive 2 offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: {
      name: 'Ryan Baldwin',
      title: 'Senior Backend Engineering Manager',
      image: 'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    },
    data: [
      { numbers: '65M+', description: 'daily events processed' },
      { numbers: '40%', description: 'more resource efficient' },
    ],
    href: '#TODO',
  },
  {
    company: 'Klarna',
    logo: MeetupLogo,
    text: 'Hive 3 offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: {
      name: 'Ryan Baldwin',
      title: 'Senior Backend Engineering Manager',
      image: 'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    },
    data: [
      { numbers: '65M+', description: 'daily events processed' },
      { numbers: '40%', description: 'more resource efficient' },
    ],
    href: '#TODO',
  },
  {
    company: 'Uber',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: {
      name: 'Ryan Baldwin',
      title: 'Senior Backend Engineering Manager',
      image: 'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    },
    data: [
      { numbers: '65M+', description: 'daily events processed' },
      { numbers: '40%', description: 'more resource efficient' },
    ],
    href: '#TODO',
  },
  {
    company: 'KLM',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: {
      name: 'Ryan Baldwin',
      title: 'Senior Backend Engineering Manager',
      image: 'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    },
    data: [
      { numbers: '65M+', description: 'daily events processed' },
      { numbers: '40%', description: 'more resource efficient' },
    ],
    href: '#TODO',
  },
];

export function CompanyTestimonialsSection({ className }: { className?: string }) {
  const tabsListRef = useRef<HTMLDivElement>(null);
  const scrollviewRef = React.useRef<HTMLDivElement>(null);
  const updateDotsOnScroll = useRef<(event: React.UIEvent) => void>(null);
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
    <section
      className={cn(
        'bg-beige-100 text-green-1000 relative overflow-hidden rounded-3xl px-4 py-6 md:p-10 lg:p-[72px]',
        className,
      )}
    >
      <Heading as="h2" size="md">
        Loved by developers, trusted by business
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
          className="lg:bg-beige-200 order-1 mt-4 flex flex-row justify-center rounded-2xl lg:order-first lg:my-16"
        >
          {testimonials.map(testimonial => {
            const Logo = testimonial.logo;
            return (
              <Tabs.Trigger
                key={testimonial.company}
                value={testimonial.company}
                className={
                  'flex-grow-0 [&[data-state="active"]>:first-child]:bg-blue-400' +
                  ' lg:rdx-state-active:bg-white lg:flex-grow lg:bg-transparent' +
                  ' justify-center p-0.5 lg:p-4' +
                  ' rdx-state-active:text-green-1000 lg:rdx-state-active:border-beige-600' +
                  ' border-transparent font-medium leading-6 text-green-800 lg:border' +
                  ' flex flex-1 justify-center rounded-[15px]'
                }
              >
                <div className="size-2 rounded-full bg-blue-200 transition-colors lg:hidden" />
                <Logo title={testimonial.company} height={32} className="hidden lg:block" />
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        <div
          ref={scrollviewRef}
          /* mobile scrollview */ className="-mb-10 flex snap-x snap-mandatory gap-4 overflow-auto pb-10"
          onScroll={updateDotsOnScroll.current}
        >
          {testimonials.map(({ company, data, href, text, person, logo: Logo }) => {
            return (
              <Tabs.Content
                key={company}
                value={company}
                tabIndex={-1}
                className={
                  'relative flex w-full shrink-0 snap-center flex-col' +
                  ' gap-6 data-[state="active"]:pb-[72px] md:flex-row md:gap-12 lg:data-[state="active"]:pb-0' +
                  ' lg:data-[state="inactive"]:hidden'
                }
                forceMount // we mount everything, as we scroll through tabs on mobile
              >
                <Image
                  src={person.image}
                  role="presentation"
                  alt=""
                  width={300}
                  height={300}
                  className="hidden size-[300px] shrink-0 rounded-3xl xl:block"
                />
                <article className="lg:relative" id={getTestimonialId(company)}>
                  <Logo title={company} height={32} className="text-blue-1000 my-6 lg:hidden" />
                  <p className="lg:text-xl xl:text-2xl xl:leading-[32px]">{text}</p>
                  <TestimonialPerson className="mt-6" person={person} />
                  <CallToAction
                    variant="primary"
                    href={href}
                    className="absolute bottom-0 w-full md:w-fit"
                  >
                    Read Case Study
                    <ArrowIcon />
                  </CallToAction>
                </article>
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
              </Tabs.Content>
            );
          })}
        </div>
      </Tabs.Root>
    </section>
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
  return (
    <div className={className}>
      <Image
        src={person.image}
        role="presentation"
        alt=""
        width={42}
        height={42}
        className="bg-beige-200 float-left mr-4 size-[42px] shrink-0 translate-y-[.5px] rounded-full xl:hidden"
      />
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
