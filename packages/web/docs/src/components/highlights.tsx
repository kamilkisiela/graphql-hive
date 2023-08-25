import { ReactNode } from 'react';
import Link from 'next/link';
import { BookIcon } from './book-icon';

export function HighlightTextLink(props: { href: string; children: ReactNode }) {
  return (
    <Link
      href={props.href}
      className="underline underline-offset-2 transition text-yellow-500 hover:text-yellow-500/75 "
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
        <div className="flex flex-1 flex-row gap-6 md:flex-col lg:flex-row" key={i}>
          <div className="lg:h-16 lg:w-16 w-12 h-12 shrink-0 text-yellow-500">{icon}</div>
          <div className="flex flex-col text-black gap-y-2">
            <h3 className="lg:text-xl text-lg font-semibold">{title}</h3>
            <p className="text-gray-600">{description}</p>
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
