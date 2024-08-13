import React from 'react';
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
    company: 'Linktree',
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
    company: 'Klarna',
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
  return (
    <section
      className={cn(
        'bg-beige-100 text-green-1000 relative overflow-hidden rounded-3xl px-4 py-6 md:p-[72px]',
        className,
      )}
    >
      <Heading as="h2" size="md">
        Loved by developers, trusted by business
      </Heading>
      <Tabs.Root defaultValue={testimonials[0].company}>
        <Tabs.List className="bg-beige-200 my-16 hidden flex-row rounded-2xl lg:flex">
          {testimonials.map(testimonial => {
            const Logo = testimonial.logo;
            return (
              <Tabs.Trigger
                key={testimonial.company}
                value={testimonial.company}
                className={
                  "data-[state='active']:text-green-1000 data-[state='active']:border-beige-600 data-[state='active']:bg-white" +
                  ' border border-transparent font-medium leading-6 text-green-800' +
                  ' flex flex-1 justify-center gap-2.5 rounded-[15px] p-2 md:p-4'
                }
              >
                <Logo title={testimonial.company} height={32} />
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        {testimonials.map(({ company, data, href, text, person, logo: Logo }) => {
          return (
            <Tabs.Content
              key={company}
              value={company}
              tabIndex={-1}
              className='relative flex flex-col gap-6 data-[state="active"]:pb-[72px] md:flex-row md:gap-12'
            >
              <Image
                src={person.image}
                role="presentation"
                alt=""
                width={300}
                height={300}
                className="hidden size-[300px] shrink-0 rounded-3xl md:block"
              />
              <article className="md:relative">
                <Logo title={company} height={32} className="text-blue-1000 my-6 md:hidden" />
                <p className="md:text-2xl md:leading-[32px]">{text}</p>
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
                  <>
                    <li key={i}>
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
                  </>
                ))}
              </ul>
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
    </section>
  );
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
        className="bg-beige-200 float-left mr-4 size-[42px] shrink-0 translate-y-[.5px] rounded-full md:hidden"
      />
      <p className="text-sm font-medium leading-[20px]">{person.name}</p>
      <p className="mt-1 text-xs text-green-800 md:text-sm">{person.title}</p>
    </div>
  );
}
