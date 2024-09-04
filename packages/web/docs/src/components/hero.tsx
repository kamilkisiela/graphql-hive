import { ReactNode } from 'react';
import {
  ArchDecoration,
  ArchDecorationGradientDefs,
  DecorationIsolation,
  HighlightDecoration,
} from '@theguild/components';
import { cn } from '../lib';

export function Hero(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-green-1000 relative isolate flex max-w-[90rem] flex-col gap-6 overflow-hidden rounded-3xl px-4 py-6 sm:pb-28 sm:pt-12 md:gap-8 lg:pb-[168px] lg:pt-24',
        props.className,
      )}
    >
      <DecorationIsolation>
        <ArchDecoration className="pointer-events-none absolute left-[-46px] top-[-20px] size-[200px] rotate-180 md:left-[-186px] md:top-[-76px] md:size-auto" />
        <ArchDecoration className="pointer-events-none absolute bottom-0 right-[-53px] size-[200px] md:-bottom-32 md:size-auto lg:bottom-0 lg:right-[-72px]" />
        <ArchDecorationGradientDefs />
      </DecorationIsolation>
      {props.children}
      <DecorationIsolation>
        <HighlightDecoration className="pointer-events-none absolute right-0 top-[-22px] overflow-visible" />
      </DecorationIsolation>
    </div>
  );
}

export function HeroLinks(props: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex flex-col justify-center gap-2 px-0.5 sm:flex-row sm:gap-4">
      {props.children}
    </div>
  );
}

export function HeroFeatures(props: { children: ReactNode }) {
  return (
    <ul className="mx-auto flex list-none flex-col gap-x-6 gap-y-2 text-sm font-medium text-white md:flex-row [&>li]:flex [&>li]:items-center [&>li]:gap-2">
      {props.children}
    </ul>
  );
}

export function HeroTitle(props: { children: ReactNode }) {
  return (
    <h1 className="mx-auto max-w-screen-lg bg-gradient-to-r from-yellow-500 via-orange-400 to-yellow-500 bg-clip-text text-center text-5xl font-semibold text-transparent sm:text-5xl lg:text-6xl">
      {props.children}
    </h1>
  );
}

export function TrustedBy({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <div className={cn('max-w-[80%] text-center', className)} {...rest}>
      <p className="text-base text-blue-800">
        Trusted by global enterprises and fast-moving startups
      </p>
      <div className="text-blue-1000 mt-6 flex flex-row flex-wrap items-center justify-center gap-x-16 gap-y-6">
        {children}
      </div>
    </div>
  );
}
