import { GlobeIcon } from '@radix-ui/react-icons';
import { DiscordIcon, GitHubIcon, TwitterIcon } from '@theguild/components';
import { cn } from '../lib';
import { ArrowIcon } from './arrow-icon';
import { CallToAction } from './call-to-action';
import { Heading } from './heading';

export function TeamSection({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'flex flex-col flex-wrap justify-center bg-blue-400 xl:h-[748px]' +
          ' grid-cols-1 rounded-3xl px-4 py-6 lg:px-8 lg:py-16 xl:px-24 xl:py-[120px]',
        className,
      )}
    >
      <Heading as="h3" size="md" className="text-green-1000 max-w-full text-balance xl:w-[468px]">
        Built by The Guild. Industry veterans.
      </Heading>

      <p className="mt-4 w-[468px] max-w-full text-green-800 lg:mt-6">
        Contrary to most, we believe in long-term sight, not temporary growth. We believe in extreme
        quality, not scrappy pivots. We believe in open, not locked. We fight for a world where
        software liberates, not confines — ensuring technology serves, not subjugates.
      </p>

      <CallToAction
        variant="secondary-inverted"
        href="https://the-guild.dev/"
        target="_blank"
        rel="noreferrer"
        className="max-xl:order-1 max-md:w-full xl:mt-12"
      >
        Visit The Guild
        <ArrowIcon />
      </CallToAction>

      <TeamGallery
        className="w-[calc(100%+2rem)] max-xl:-mx-4 max-xl:px-4 max-xl:py-6 xl:w-[636px]"
        style={{
          '--size': '120px',
        }}
      />
    </section>
  );
}

type TeamMember = [name: string, avatar: string, social: string];
const team: TeamMember[] = [
  ['Denis Badurina', '', ''],
  ['Dimitri Postolov', '', ''],
  ['Dotan Simha', '', ''],
  ['Gil Gardosh', '', ''],

  ['Kamil Kisiela', '', ''],
  ['Laurin Quast', '', ''],
  ['Noam Malka', '', ''],
  ['Saihajpreet Singh', '', ''],

  ['Tuval Simha', '', ''],
  ['Uri Goldshtein', '', ''],
  ['Valentin Cocaud', '', ''],
  ['Yassin Eldeeb', '', ''],
];

function TeamGallery(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <ul
      {...props}
      className={cn(
        'flex flex-row gap-2 max-lg:overflow-auto lg:flex-wrap lg:gap-4 xl:gap-8' +
          ' shrink-0 xl:[&>:nth-child(8n-7)]:ml-[calc(var(--size)/2)]' +
          ' grid-cols-6 items-stretch justify-items-stretch lg:max-xl:grid',
        props.className,
      )}
    >
      {team.map((member, i) => (
        <TeamAvatar key={i} data={member} />
      ))}
    </ul>
  );
}

function TeamAvatar({ data: [name, avatar, social] }: { data: TeamMember }) {
  return (
    <div className="relative">
      <a
        className={
          'absolute right-0 top-0 rounded-2xl border-2 bg-[#222530] p-[9px] text-white hover:border-[#222530] xl:rounded-full' +
          ' border-transparent xl:-translate-y-1/2 xl:translate-x-1/2' +
          ' max-xl:min-size-[var(--size)] max-xl:opacity-0'
        }
        href={social}
      >
        {social.startsWith('https://github.com') ? (
          <GitHubIcon className="size-[14px]" />
        ) : social.startsWith('https://discord.com') ? (
          <DiscordIcon className="size-[14px]" />
        ) : social.startsWith('https://twitter.com') ? (
          <TwitterIcon className="size-[14px]" />
        ) : (
          <GlobeIcon className="size-[14px]" />
        )}
      </a>
      <div
        role="presentation"
        className="aspect-square min-h-[var(--size)] min-w-[var(--size)] rounded-2xl bg-['linear-gradient(0deg,#A2C1C4_0%,#A2C1C4_100%),url(var(--src))_lightgray_50%_/_cover_no-repeat'] bg-blue-300"
        style={{
          '--src': 'https://place.dog/120/120' + '?' + 'name=' + avatar,
          backgroundBlendMode: 'multiply, normal',
        }}
      />
      <span className="text-green-1000 mt-2 block text-sm font-medium leading-5 lg:max-xl:block lg:max-xl:text-base">
        {name}
      </span>
    </div>
  );
}
