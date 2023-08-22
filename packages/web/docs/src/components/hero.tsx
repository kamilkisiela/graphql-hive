import { ReactNode } from 'react';

export function HeroTitle(props: { children: ReactNode }) {
  return (
    <h1 className="mx-auto max-w-screen-lg bg-gradient-to-r from-yellow-500 via-orange-400 to-yellow-500 bg-clip-text text-center text-5xl font-extrabold text-transparent dark:from-yellow-400 dark:to-orange-500 sm:text-5xl lg:text-6xl">
      {props.children}
    </h1>
  );
}

export function HeroSubtitle(props: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-6 max-w-screen-sm text-center text-lg text-gray-700 dark:text-gray-200">
      {props.children}
    </p>
  );
}

export function HeroLinks(props: { children: ReactNode }) {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
      {props.children}
    </div>
  );
}

export function Hero(props: { children: ReactNode }) {
  return (
    <div className="w-full relative">
      <div className="my-6 py-20 px-2 sm:py-24 lg:py-32 relative">{props.children}</div>
    </div>
  );
}
