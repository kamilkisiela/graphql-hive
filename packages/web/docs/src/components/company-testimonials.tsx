import React from 'react';
import Image from 'next/image';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowIcon } from './arrow-icon';
import { CallToAction } from './call-to-action';
import { Heading } from './heading';
import { MeetupLogo } from './logos';

type Testimonial = {
  company: string;
  logo: (props: { title: string; height: number }) => React.ReactElement;
  text: string;
  person: [name: string, title: string, image: string];
  data: Array<[numbers: string, description: string]>;
  href: string;
};

const testimonials: Testimonial[] = [
  {
    company: 'Meetup',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: [
      'Ryan Baldwin',
      'Senior Backend Engineering Manager',
      'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    ],
    data: [
      ['65M+', 'daily events processed'],
      ['40%', 'more resource efficient'],
    ],
    href: '#TODO',
  },
  {
    company: 'Meetup',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: [
      'Ryan Baldwin',
      'Senior Backend Engineering Manager',
      'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    ],
    data: [
      ['65M+', 'daily events processed'],
      ['40%', 'more resource efficient'],
    ],
    href: '#TODO',
  },
  {
    company: 'Meetup',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: [
      'Ryan Baldwin',
      'Senior Backend Engineering Manager',
      'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    ],
    data: [
      ['65M+', 'daily events processed'],
      ['40%', 'more resource efficient'],
    ],
    href: '#TODO',
  },
  {
    company: 'Meetup',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: [
      'Ryan Baldwin',
      'Senior Backend Engineering Manager',
      'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    ],
    data: [
      ['65M+', 'daily events processed'],
      ['40%', 'more resource efficient'],
    ],
    href: '#TODO',
  },
  {
    company: 'Meetup',
    logo: MeetupLogo,
    text: 'Hive offers an impressive suite of tools for managing and monitoring GraphQL schemas. The collaborative features, such as schema sharing and team-based permissions, have streamlined our development process.',
    person: [
      'Ryan Baldwin',
      'Senior Backend Engineering Manager',
      'https://github.com/user-attachments/assets/107be3fa-1051-49d5-b3d7-8fe374a3bd03',
    ],
    data: [
      ['65M+', 'daily events processed'],
      ['40%', 'more resource efficient'],
    ],
    href: '#TODO',
  },
];

export function CompanyTestimonialsSection() {
  return (
    <section
      className={
        'bg-beige-100 text-green-1000 relative mx-1 overflow-hidden rounded-3xl md:mx-6' +
        ' p-8 md:p-[72px]'
      }
    >
      <Heading as="h2" size="md" className="text-center">
        Loved by developers, trusted by business
      </Heading>
      <Tabs.Root defaultValue={testimonials[0].company}>
        <Tabs.List className="bg-beige-200 mb-16 hidden flex-row rounded-2xl lg:flex">
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
        {testimonials.map(
          ({ company, data, href, text, person: [personName, personTitle, image] }) => {
            return (
              <Tabs.Content key={company} value={company} tabIndex={-1}>
                <Image
                  src={image}
                  alt={personName}
                  width={300}
                  height={300}
                  className="hidden rounded-full lg:block"
                />
                <article className="flex flex-row gap-12">
                  <p className="lg:text-2xl lg:leading-[32px]">{text}</p>
                  <dl>
                    {data.map(([numbers, description]) => (
                      <div>
                        <dt
                          className={
                            'text-[40px] leading-[1.2] tracking-[-0.2px]' +
                            ' md:text-6xl md:leading-[1.1875] md:tracking-[-0.64px]'
                          }
                        >
                          {numbers}
                        </dt>
                        <dd className="mt-2">{description}</dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    <p className='font-medium'>{}</p>
                    <p className="text-green-800">{personTitle}</p>
                  </div>
                  <CallToAction variant="primary" href={href}>
                    Read Case Study
                    <ArrowIcon />
                  </CallToAction>
                </article>
              </Tabs.Content>
            );
          },
        )}
      </Tabs.Root>
    </section>
  );
}
