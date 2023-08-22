import { ReactNode } from 'react';
import CountUp from 'react-countup';

export function StatsItem(props: {
  label: string;
  value: number;
  suffix: string;
  decimal?: boolean;
}) {
  return (
    <div>
      <div className="font-bold text-5xl text-center">
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
        {props.suffix}+
      </div>
      <div className="text-gray-600 dark:text-gray-400 uppercase font-semibold text-center">
        {props.label}
      </div>
    </div>
  );
}

export function StatsList(props: { children: ReactNode }) {
  return (
    <div className="container mx-auto box-border grid grid-cols-2 lg:grid-cols-4 gap-8 px-6 py-12">
      {props.children}
    </div>
  );
}
