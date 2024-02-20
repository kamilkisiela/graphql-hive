import { ReactNode } from 'react';
import Link from 'next/link';
import { BookIcon } from './book-icon';

export function HighlightTextLink(props: { href: string; children: ReactNode }) {
  return (
    <Link
      href={props.href}
      className="text-yellow-500 underline underline-offset-2 transition hover:text-yellow-500/75 "
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
    <div className="container mx-auto box-border flex flex-col justify-between gap-12 px-6 py-12 md:flex-row">
      {props.items.map(({ title, description, icon, documentationLink }, i) => (
        <div className="flex flex-1 flex-row gap-6 md:flex-col lg:flex-row" key={i}>
          <div className="size-12 shrink-0 text-yellow-500 lg:size-16">{icon}</div>
          <div className="flex flex-col gap-y-2 text-black">
            <h3 className="text-lg font-semibold lg:text-xl">{title}</h3>
            <p className="text-gray-600">{description}</p>
            <Link
              href={documentationLink}
              className="group mt-4 inline-flex items-center gap-x-2 font-semibold text-yellow-500 underline-offset-8 transition hover:underline"
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
