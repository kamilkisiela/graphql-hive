import { ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { BookIcon } from './book-icon';

const classes = {
  root: clsx('flex flex-1 flex-row gap-6 md:flex-col lg:flex-row'),
  content: clsx('flex flex-col text-black dark:text-white'),
  title: clsx('text-xl font-semibold'),
  description: clsx('text-gray-600 dark:text-gray-400'),
};

export function HighlightTextLink(props: { href: string; children: ReactNode }) {
  return (
    <Link
      href={props.href}
      className="underline underline-offset-2 transition text-yellow-500 hover:text-yellow-500/75 dark:text-yellow-600 dark:hover:text-yellow-500/100"
    >
      {props.children}
    </Link>
  );
}

export function Highlights(props: {
  items: Array<{
    title: string;
    description: ReactNode;
    icon: ReactNode;
    documentationLink: string;
  }>;
}) {
  return (
    <div className="container mx-auto box-border flex flex-col justify-between gap-12 md:flex-row px-6 py-12">
      {props.items.map(({ title, description, icon, documentationLink }, i) => (
        <div className={classes.root} key={i}>
          <div className="h-16 w-16 shrink-0 text-yellow-500">{icon}</div>
          <div className={classes.content}>
            <h3 className={classes.title}>{title}</h3>
            <p className={classes.description}>{description}</p>
            <Link
              href={documentationLink}
              className="mt-4 group inline-flex font-semibold items-center transition hover:underline underline-offset-8 gap-x-2 text-yellow-500"
            >
              <div>
                <BookIcon size={16} />
              </div>
              <div>Learn more</div>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
