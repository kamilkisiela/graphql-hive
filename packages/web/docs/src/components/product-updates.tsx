import { ReactElement } from 'react';
import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';

type Changelog = {
  title: string;
  date: string;
  description: string;
  route: string;
};

function ProductUpdateTeaser(props: Changelog) {
  return (
    <li className="mb-10 ml-4">
      <div className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700" />
      <time
        className="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500"
        dateTime={props.date}
      >
        {format(new Date(props.date), 'do MMMM yyyy')}
      </time>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        <Link href={props.route}>{props.title}</Link>
      </h3>
      <div className="mb-4 mt-1 max-w-[600px] text-base font-normal leading-6 text-gray-500 dark:text-gray-400">
        {props.description}
      </div>
    </li>
  );
}

export const ProductUpdates = (props: { changelogs: Changelog[] }): ReactElement => {
  return (
    <>
      <div className="pb-12">
        <h1 className="!m-0 !text-left">Product Updates</h1>
        <p>The most recent developments from GraphQL Hive.</p>
      </div>
      <ol className="relative border-l border-gray-200 dark:border-gray-700">
        {props.changelogs.map(item => (
          <ProductUpdateTeaser key={item.route} {...item} />
        ))}
      </ol>
    </>
  );
};

export async function getChangelogs(): Promise<Changelog[]> {
  const { pageMap } = await import('../../.next/static/chunks/nextra-page-map-.mjs');

  const productUpdatesFolder = pageMap.find(item => item.route === '/product-updates').children;

  return productUpdatesFolder
    .map(item => {
      if (!item.children) {
        // Regular mdx page
        return {
          title: item.frontMatter.title,
          date: item.frontMatter.date.toISOString(),
          description: item.frontMatter.description,
          route: item.route,
        };
      }
      // Folder
      const indexPage = item.children.find(item => item.name === 'index');
      if (!indexPage) {
        throw new Error('Changelog folder must have an "index.mdx" page');
      }

      return {
        title: indexPage.frontMatter.title,
        date: indexPage.frontMatter.date.toISOString(),
        description: indexPage.frontMatter.description,
        route: indexPage.route,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const getStaticProps: GetStaticProps<{ ssg: { changelogs: Changelog[] } }> = async () => {
  return {
    props: {
      __nextra_dynamic_opts: {
        title: 'Product Updates',
        frontMatter: {
          description: 'The most recent developments from GraphQL Hive.',
        },
      },
      ssg: { changelogs: await getChangelogs() },
    },
  };
};
