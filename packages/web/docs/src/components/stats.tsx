import { ReactNode } from 'react';
import CountUp from 'react-countup';
import { Heading } from '@theguild/components';
import { cn } from '../lib';

export function StatsItem(props: {
  label: string;
  value: number;
  suffix: string;
  decimal?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4 rounded-3xl border border-green-400 p-8 lg:flex-col lg:items-start lg:p-12">
      <Heading as="div" size="xl" className="text-green-1000 min-w-[120px] text-[48px] lg:text-6xl">
        <CountUp
          start={0}
          end={props.value}
          duration={2}
          decimals={props.decimal ? 1 : 0}
          decimal="."
          scrollSpyDelay={100}
          enableScrollSpy
          scrollSpyOnce
        />
        {props.suffix}
      </Heading>
      <div className="mb-3 font-medium max-md:text-right sm:mb-3 md:mb-2 lg:mb-0">
        {props.label}
      </div>
    </div>
  );
}

export function StatsList(props: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('p-6 sm:py-20 md:py-24 xl:px-[120px]', props.className)}>
      <Heading as="h2" size="md" className="text-center">
        Living and breathing GraphQL
      </Heading>
      <div className="mx-auto mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-6 lg:mt-16 lg:grid-cols-4">
        {props.children}
      </div>
    </section>
  );
}
