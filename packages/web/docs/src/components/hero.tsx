import { ReactNode } from 'react';
import { cn } from '../lib';

export function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" fill="none" {...props}>
      <path
        d="M16.667 5 7.5 14.167 3.333 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Hero(props: { children: ReactNode }) {
  return (
    <div className="bg-green-1000 relative mx-1 flex flex-col gap-8 overflow-hidden rounded-3xl pb-52 pt-24 md:mx-6">
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

function ArchDecoration(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="432" height="432" {...props}>
      <path
        d="M.75 431v.25h90.24V160.868c0-38.596 31.282-69.878 69.878-69.878H431.25V.75H191.864a47.017 47.017 0 0 0-33.23 13.771l-68.07 68.071-7.972 7.971-68.07 68.071A47.018 47.018 0 0 0 .75 191.864V431Z"
        fill="url(#arch-decoration-a)"
        stroke="url(#arch-decoration-b)"
        strokeWidth=".5"
      />
    </svg>
  );
}

function ArchDecorationGradientDefs() {
  return (
    <svg width="432" height="432" className="absolute -z-10">
      <defs>
        <linearGradient
          id="arch-decoration-a"
          x1="48.5"
          y1="53.5"
          x2="302.5"
          y2="341"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#fff" stop-opacity=".1" />
          <stop offset="1" stop-color="#fff" stop-opacity=".3" />
        </linearGradient>
        <linearGradient
          id="arch-decoration-b"
          x1="1"
          y1="1"
          x2="431"
          y2="431"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#fff" stop-opacity=".1" />
          <stop offset="1" stop-color="#fff" stop-opacity=".4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HighlightDecoration(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg width="895" height="674" viewBox="0 0 895 674" {...props}>
      <g filter="url(#filter0_f_711_1774)">
        <path
          d="M350 280.534C350 296.208 356.24 311.261 367.33 322.351L453.447 408.468L463.532 418.553L549.649 504.67C560.739 515.76 575.792 522 591.466 522L894 522L894 408.468L552.251 408.468C503.249 408.468 463.532 368.751 463.532 319.749L463.532 -22L350 -22L350 280.534Z"
          fill="#86B6C1"
        />
      </g>
      <defs>
        <filter
          id="filter0_f_711_1774"
          x="-3.05176e-05"
          y="-372"
          width="1244"
          height="1244"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="175" result="effect1_foregroundBlur_711_1774" />
        </filter>
      </defs>
    </svg>
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
