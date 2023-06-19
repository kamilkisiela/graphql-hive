import { ReactElement } from 'react';
import { Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDocsUrl } from '@/lib/docs-url';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Link } from './link';

export const DocsNote = ({ children, warn }: { warn?: boolean; children: React.ReactNode }) => {
  return (
    <div
      className={cn('flex my-2 border-l-2 px-4 py-2', warn ? 'border-orange-500' : 'border-white')}
    >
      {/* <div className="items-center align-middle pr-2 flex flex-row">
        {warn ? (
          <ExclamationTriangleIcon className="text-orange-500" />
        ) : (
          <InfoCircledIcon className="text-current" />
        )}
      </div> */}
      <div className="grow text-white text-sm align-middle">{children}</div>
    </div>
  );
};

export const DocsLink = ({
  href,
  children,
  icon,
  className,
}: {
  href: string;
  icon?: ReactElement;
  children?: React.ReactNode;
  className?: string;
}) => {
  const fullUrl = href.startsWith('http')
    ? href
    : getDocsUrl(href) || 'https://docs.graphql-hive.com/';

  return (
    <Button variant="link" className={cn('p-0 text-orange-500', className)} asChild>
      <Link href={fullUrl} target="_blank" rel="noreferrer">
        {icon ?? <Book className="mr-2 w-4 h-4" />}
        {children}
        <ExternalLinkIcon className="inline pl-1" />
      </Link>
    </Button>
  );
};
