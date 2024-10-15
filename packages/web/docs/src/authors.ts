type Author = {
  name: string;
  link: `https://${string}`;
  github?: string;
  twitter?: string;
};

export const authors: Record<string, Author> = {
  kamil: {
    name: 'Kamil Kisiela',
    link: 'https://x.com/kamilkisiela',
    github: 'kamilkisiela',
  },
  laurin: {
    name: 'Laurin Quast',
    link: 'https://x.com/n1rual',
    github: 'n1ru4l',
  },
  arda: {
    name: 'Arda Tanrikulu',
    link: 'https://twitter.com/ardatanrikulu',
    github: 'ardatan',
  },
  aleksandra: {
    name: 'Aleksandra Sikora',
    link: 'https://x.com/aleksandrasays',
    github: 'beerose',
  },
  jiri: {
    name: 'Jiri Spac',
    link: 'https://x.com/capajj',
    github: 'capaj',
  },
  dimitri: {
    name: 'Dimitri Postolov',
    link: 'https://x.com/dimaMachina_',
    github: 'dimaMachina',
  },
};
