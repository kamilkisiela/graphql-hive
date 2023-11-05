import fs from 'node:fs';
import path from 'node:path';
import { ReactElement } from 'react';
import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import matter from 'gray-matter';

type Changelog = {
  title: string;
  date: string;
  description: string;
  route: string;
};

function ProductUpdateTeaser(props: Changelog) {
  return (
    <li className="mb-10 ml-4">
      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700" />
      <time
        className="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500"
        dateTime={props.date}
      >
        {format(new Date(props.date), 'do MMMM yyyy')}
      </time>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        <Link href={props.route}>{props.title}</Link>
      </h3>
      <p className="mb-4 text-base font-normal text-gray-500 dark:text-gray-400">
        {props.description}
      </p>
    </li>
  );
}

export const ProductUpdates = ({
  changelogs,
}: InferGetStaticPropsType<typeof getStaticProps>): ReactElement => {
  return (
    <>
      <div className="pb-12">
        <h1 className="!m-0 !text-left">Product Updates</h1>
        <p>The most recent developments from GraphQL Hive.</p>
      </div>
      <ol className="relative border-l border-gray-200 dark:border-gray-700">
        {changelogs.map(item => (
          <ProductUpdateTeaser key={item.route} {...item} />
        ))}
      </ol>
    </>
  );
};

export const getStaticProps: GetStaticProps<{ changelogs: Changelog[] }> = async () => {
  const productUpdatesDirectory = path.join(process.cwd(), 'src', 'pages', 'product-updates');
  const filenames = fs.readdirSync(productUpdatesDirectory);

  const changelogs: Changelog[] = [];

  for (const filename of filenames) {
    if (filename.endsWith('.json') || filename.endsWith('index.mdx')) {
      continue;
    }

    const { data } = matter(
      fs.readFileSync(path.join(productUpdatesDirectory, filename), 'utf8'),
      {},
    );

    if (data.title && data.description && data.date) {
      changelogs.push({
        date: data.date.toISOString(),
        title: data.title,
        description: data.description,
        route: `/product-updates/${filename.replace(/\.mdx$/, '')}`,
      });
    }
  }

  changelogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { props: { changelogs } };
};
