import type { Item, MenuItem, PageItem } from 'nextra/normalize-pages';
import { PRODUCTS, SIX_HIGHLIGHTED_PRODUCTS } from '@theguild/components/products';
import { cn } from '../lib';

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
    items: Object.fromEntries(
      (
        [
          'The GraphQL Stack',
          PRODUCTS.MESH,
          PRODUCTS.YOGA,
          PRODUCTS.CODEGEN,
          'Libraries',
          ...SIX_HIGHLIGHTED_PRODUCTS,
        ] as const
      ).map((item, i) => {
        if (typeof item === 'string') {
          return [
            i,
            {
              type: 'separator',
              title: (
                <>
                  {/* This is a one-off class, because I want to style the parent. */}
                  {/* eslint-disable-next-line tailwindcss/no-custom-classname */}
                  <style className="label-separator">
                    {
                      'li:has(.label-separator) { margin: 0.75rem 0 0.25rem 0 !important; padding: 0 !important; }'
                    }
                  </style>
                  <span className="ml-2 font-medium text-[var(--hive-meta-label-color)]">
                    {item}
                  </span>
                </>
              ) as any as string,
            },
          ];
        }
        const Logo = item.logo;
        return [
          i,
          {
            type: 'page',
            href: item.href,
            newWindow: true,
            title: (
              <div className="flex items-center gap-2">
                <Logo
                  className={cn(
                    'size-4 translate-y-[0.25px]',
                    i > 3 && 'rounded-sm bg-[var(--hive-meta-lettermark-bg)] text-[8px] text-white',
                  )}
                />
                {item.name}
              </div>
            ),
          },
        ];
      }),
    ),
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
