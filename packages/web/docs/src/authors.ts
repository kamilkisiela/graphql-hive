type Author = {
  name: string;
  link: `https://${string}`;
  github?: string;
  twitter?: string;
};

export const authors: Record<string, Author> = {
  kamil: {
    name: 'Kamil Kisiela',
    link: 'https://twitter.com/kamilkisiela',
    github: 'kamilkisiela',
  },
  laurin: {
    name: 'Laurin Quast',
    link: 'https://twitter.com/n1rual',
    github: 'n1ru4l',
  },
};
