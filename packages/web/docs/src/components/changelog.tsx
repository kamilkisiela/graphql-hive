import { ReactElement } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

function ChangelogItem(props: { title: string; date: string; description: string; route: string }) {
  return (
    <li className="mb-10 ml-4">
      <div className="absolute w-3 h-3 bg-gray-200 rounded-full mt-1.5 -left-1.5 border border-white dark:border-gray-900 dark:bg-gray-700" />
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

export const Changelog = ({ changelogs }): ReactElement => {
  return (
    <>
      <div className="pb-12">
        <h1 className="!text-left !m-0">Changelog</h1>
        <p>The most recent developments from GraphQL Hive.</p>
      </div>
      <ol className="relative border-l border-gray-200 dark:border-gray-700">
        {changelogs.map(item => (
          <ChangelogItem key={item.href} {...item} />
        ))}
      </ol>
    </>
  );
};
