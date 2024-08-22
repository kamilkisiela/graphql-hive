import { cn } from '../lib';
import { CallToAction } from './call-to-action';
import { Heading } from './heading';

export function GetYourAPIGameRightSection({ className }: { className?: string }) {
  return (
    <section
      className={cn(className, 'bg-primary relative overflow-hidden rounded-3xl md:h-[308px]')}
    >
      <GreenArchDecoration className="absolute inset-y-0 right-0 hidden opacity-10 md:block [@media(min-width:1300px)]:opacity-100" />
      <StrokeDecoration className="absolute right-[607px] max-md:right-[-36px] max-md:top-[-71px] max-md:size-[200px] max-md:rotate-180 md:bottom-0" />
      <div className="flex flex-col items-stretch justify-between gap-x-6 gap-y-4 p-4 sm:items-center md:h-[308px] md:flex-row md:px-24">
        <Heading
          as="h2"
          size="md"
          className="text-[40px] leading-[1.2] tracking-[-0.2px] max-sm:text-balance max-sm:text-center md:text-[56px] md:leading-[1.142586] md:tracking-[-0.56px]"
        >
          Get your API game right.
        </Heading>
        <div className="flex flex-col gap-x-4 gap-y-2 whitespace-pre sm:flex-row">
          <CallToAction variant="secondary-inverted" href="https://app.graphql-hive.com/">
            Get started for free
          </CallToAction>
          <CallToAction variant="tertiary" href="https://the-guild.dev/contact">
            Talk to us
          </CallToAction>
        </div>
      </div>
    </section>
  );
}

function GreenArchDecoration(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width={538}
      height={309}
      viewBox="0 0 538 309"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M0 127.88c0 11.695 4.565 22.926 12.679 31.201l63.005 64.257 7.378 7.524 63.005 64.257c8.113 8.275 19.126 12.931 30.594 12.931H546.5v-84.712H147.971c-35.852 0-64.91-29.635-64.91-66.199V-97.857H0V127.88z"
        fill="url(#paint0_linear_711_2526)"
      />
      <defs>
        <linearGradient
          id="paint0_linear_711_2526"
          x1={273.25}
          y1={-3.009_75}
          x2={273.25}
          y2={308.05}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#55998D" />
          <stop offset={1} stopColor="#245850" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function StrokeDecoration(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width={304}
      height={284}
      viewBox="0 0 304 284"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M293.962 111.972a32.561 32.561 0 019.538 23.014V303.55h-62.444V113.073c0-27.66-22.419-50.079-50.079-50.079H.5V.55h168.563a32.565 32.565 0 0123.015 9.538l48.124 48.124 5.636 5.636 48.124 48.124z"
        stroke="url(#paint0_linear_711_2520)"
      />
      <defs>
        <linearGradient
          id="paint0_linear_711_2520"
          x1={152}
          y1={159.05}
          x2={294.5}
          y2={5.049_82}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A2C1C4" stopOpacity={0} />
          <stop offset={1} stopColor="#A2C1C4" stopOpacity={0.8} />
        </linearGradient>
      </defs>
    </svg>
  );
}
