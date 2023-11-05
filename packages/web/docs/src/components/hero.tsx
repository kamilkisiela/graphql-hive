import { ReactNode } from 'react';

export function HeroTitle(props: { children: ReactNode }) {
  return (
    <h1 className="mx-auto max-w-screen-lg bg-gradient-to-r from-yellow-500 via-orange-400 to-yellow-500 bg-clip-text text-center text-5xl font-semibold text-transparent sm:text-5xl lg:text-6xl">
      {props.children}
    </h1>
  );
}

export function HeroSubtitle(props: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-6 max-w-screen-sm text-center text-lg font-light text-gray-700">
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

export function HereTrustedBy(props: { children: ReactNode }) {
  return (
    <div className="mt-24 lg:mt-36">
      <div className="mx-auto max-w-[80%] text-center lg:max-w-screen-lg">
        <p className="text-sm text-gray-700">
          Trusted by global enterprises and fast-moving startups.
        </p>
        <div className="mt-10 flex flex-row flex-wrap items-center justify-center gap-x-12 gap-y-6 text-gray-700">
          {props.children}
        </div>
      </div>
    </div>
  );
}

export function Hero(props: { children: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden bg-white">
      <div className="my-6 px-2 py-20 sm:py-24 lg:py-32">
        <div className="relative z-10">{props.children}</div>
      </div>
    </div>
  );
}
