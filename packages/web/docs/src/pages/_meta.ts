import type { Item, MenuItem, PageItem } from 'nextra/normalize-pages';
import { PRODUCTS_MENU_LIST } from '@theguild/components/products';

const meta: Record<string, DeepPartial<Item | MenuItem | PageItem>> = {
  index: {
    title: 'Home',
    type: 'page',
    display: 'hidden',
    theme: {
      layout: 'raw',
    },
  },
  hive: {
    title: 'Get Started',
    type: 'page',
    href: 'https://app.graphql-hive.com',
    newWindow: true,
  },
  'contact-us': {
    title: 'Contact Us',
    type: 'page',
    href: 'https://the-guild.dev/contact',
    newWindow: true,
  },
  status: {
    title: 'Status',
    type: 'page',
    href: 'https://status.graphql-hive.com',
    newWindow: true,
  },
  docs: {
    title: 'Documentation',
    type: 'page',
    theme: {
      toc: true,
    },
  },
  products: {
    title: 'Products',
    type: 'menu',
    items: PRODUCTS_MENU_LIST,
  },
  'product-updates': {
    type: 'page',
    title: 'Product Updates',
    theme: {
      sidebar: false,
      toc: true,
      breadcrumb: false,
      typesetting: 'article',
    },
  },
  blog: {
    title: 'Blog',
    type: 'page',
    href: 'https://the-guild.dev/blog',
    newWindow: true,
  },
  github: {
    title: 'GitHub',
    type: 'page',
    href: 'https://github.com/graphql-hive/platform',
    newWindow: true,
  },
  'the-guild': {
    title: 'The Guild',
    type: 'menu',
    items: {
      'about-us': {
        title: 'About Us',
        href: 'https://the-guild.dev/about-us',
        newWindow: true,
      },
      'brand-assets': {
        title: 'Brand Assets',
        href: 'https://the-guild.dev/logos',
        newWindow: true,
      },
    },
  },
  'graphql-foundation': {
    title: 'GraphQL Foundation',
    type: 'page',
    href: 'https://graphql.org/community/foundation/',
    newWindow: true,
  },
};

export default meta;

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
