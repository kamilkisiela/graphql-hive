import { ReactNode } from 'react';
import { cn } from '../lib';
import { ArchDecoration, ArchDecorationGradientDefs, HighlightDecoration } from './decorations';

export function Hero(props: { children: ReactNode }) {
  return (
    <div className="bg-green-1000 relative mx-1 flex max-w-[90rem] flex-col gap-8 overflow-hidden rounded-3xl pb-52 pt-24 md:mx-6">
      <ArchDecoration className="pointer-events-none absolute left-[-186px] top-[-76px] rotate-180" />
      <ArchDecoration className="pointer-events-none absolute bottom-0 right-[-72px]" />
      <ArchDecorationGradientDefs />
      {props.children}
      <HighlightDecoration className="pointer-events-none absolute right-0 top-[-22px] overflow-visible" />
    </div>
  );
}

export function HeroLinks(props: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex flex-row justify-center gap-4 px-0.5">{props.children}</div>
  );
}

export function HeroFeatures(props: { children: ReactNode }) {
  return (
    <ul className="mx-auto flex list-none flex-col gap-x-6 gap-y-2 text-sm text-white md:flex-row [&>li]:flex [&>li]:items-center [&>li]:gap-2">
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
