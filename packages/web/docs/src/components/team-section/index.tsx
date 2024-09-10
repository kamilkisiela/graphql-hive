import Image, { StaticImageData } from 'next/image';
import { CallToAction, Heading } from '@theguild/components';
import { cn } from '../../lib';
import { ArrowIcon } from '../arrow-icon';
import dimaPhoto from './dima.webp';
// import noamPhoto from './noam.webp';
import saihajPhoto from './saihaj.webp';

export function TeamSection({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        'isolate max-w-full rounded-3xl bg-blue-400 px-4 py-6 lg:px-8 lg:py-16 xl:px-16 xl:py-[120px] [@media(min-width:1358px)]:px-24',
        className,
      )}
    >
      <div className="mx-auto flex max-w-full flex-col flex-wrap justify-center gap-x-2 lg:max-xl:w-max xl:h-[476px]">
        <Heading as="h3" size="md" className="text-green-1000 max-w-full text-balance xl:w-[468px]">
          Built by The Guild. Industry veterans.
        </Heading>

        <p className="mt-4 w-[468px] max-w-full text-green-800 lg:mt-6">
          Contrary to most, we believe in long-term sight, not temporary growth. We believe in
          extreme quality, not scrappy pivots. We believe in open, not locked. We fight for a world
          where software liberates, not confines — ensuring technology serves, not subjugates.
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
          className={cn(
            'max-xl:-mx-4 max-xl:max-w-[calc(100%-1rem)] max-xl:px-4 max-xl:py-6 max-lg:max-w-[calc(100%+2rem)] xl:ml-auto',
            team.length === 12 ? 'xl:w-[628px]' : 'xl:w-[664px]',
          )}
          style={{
            '--size': '120px',
          }}
        />
      </div>
    </section>
  );
}

type TeamMember = [name: string, avatar: string | StaticImageData, social: string];
const team: TeamMember[] = [
  [
    'Denis Badurina',
    'https://avatars.githubusercontent.com/enisdenjo?v=4&s=180',
    'https://github.com/enisdenjo',
  ],
  ['Dimitri Postolov', dimaPhoto, 'https://github.com/dimaMachina'],
  [
    'Dotan Simha',
    'https://avatars.githubusercontent.com/dotansimha?v=4&s=180',
    'https://github.com/dotansimha',
  ],
  [
    'Gil Gardosh',
    'https://avatars.githubusercontent.com/gilgardosh?v=4&s=180',
    'https://github.com/gilgardosh',
  ],

  [
    'Kamil Kisiela',
    'https://avatars.githubusercontent.com/kamilkisiela?v=4&s=180',
    'https://github.com/kamilkisiela',
  ],
  [
    'Laurin Quast',
    'https://avatars.githubusercontent.com/n1ru4l?v=4&s=180',
    'https://github.com/n1ru4l',
  ],
  // ['Noam Malka', noamPhoto, 'https://noam-malka.com/'],
  ['Saihajpreet Singh', saihajPhoto, 'https://github.com/saihaj'],

  [
    'Tuval Simha',
    'https://avatars.githubusercontent.com/tuvalsimha?v=4&s=180',
    'https://github.com/tuvalsimha',
  ],
  [
    'Uri Goldshtein',
    'https://avatars.githubusercontent.com/Urigo?v=4&s=180',
    'https://github.com/Urigo',
  ],
  [
    'Valentin Cocaud',
    'https://avatars.githubusercontent.com/EmrysMyrddin?v=4&s=180',
    'https://github.com/EmrysMyrddin',
  ],
  [
    'Yassin Eldeeb',
    'https://avatars.githubusercontent.com/YassinEldeeb?v=4&s=180',
    'https://github.com/YassinEldeeb',
  ],
  [
    'Arda Tanrikulu',
    'https://avatars.githubusercontent.com/ardatan?v=4&s=180',
    'https://github.com/ardatan',
  ],
];

function TeamGallery(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <ul
      {...props}
      className={cn(
        'flex flex-row gap-2 max-lg:overflow-auto lg:flex-wrap lg:gap-6' +
          ' shrink-0 grid-cols-5 items-stretch justify-items-stretch lg:max-xl:grid',
        team.length === 13
          ? 'grid-cols-5 xl:[&>:nth-child(9n-8)]:ml-[calc(var(--size)/2)]'
          : 'grid-cols-6 xl:[&>:nth-child(8n-7)]:ml-[calc(var(--size)/2)]',
        props.className,
      )}
    >
      {team.map((member, i) => (
        <li key={i}>
          <TeamAvatar data={member} />
        </li>
      ))}
    </ul>
  );
}

function TeamAvatar({ data: [name, avatar, social] }: { data: TeamMember }) {
  return (
    <a
      className="group relative flex flex-col focus-visible:outline-none focus-visible:ring-transparent focus-visible:ring-offset-transparent"
      href={social}
      target="_blank"
      rel="noreferrer"
    >
      <div className="relative aspect-square min-h-[var(--size)] w-auto min-w-[var(--size)] flex-1 overflow-hidden rounded-2xl mix-blend-multiply ring-blue-500/0 ring-offset-2 transition-all hover:ring-4 hover:ring-blue-500/15 group-focus:ring-blue-500/40 group-focus-visible:ring-4 xl:w-[var(--size)]">
        <div className="absolute inset-0 size-full bg-blue-100" />
        <Image
          alt=""
          className="rounded-2xl bg-black brightness-100 grayscale transition-all duration-500 group-hover:scale-[1.03] group-hover:brightness-110"
          {...(typeof avatar === 'string'
            ? { src: avatar }
            : { blurDataURL: avatar.blurDataURL, src: avatar.src })}
          width={180}
          height={180}
        />
        <div className="absolute inset-0 size-full bg-blue-500 opacity-10 transition-all group-hover:opacity-20" />
      </div>
      <span className="text-green-1000 mt-2 block text-sm font-medium leading-5 lg:max-xl:block lg:max-xl:text-base">
        {name}
      </span>
    </a>
  );
}
