import { ReactElement } from 'react';
import { Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDocsUrl } from '@/lib/docs-url';
import { cn } from '@/lib/utils';
import { ExclamationTriangleIcon, ExternalLinkIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Link } from './link';

export const DocsNote = ({ children, warn }: { warn?: boolean; children: React.ReactNode }) => {
  return (
    <div className="flex my-2">
      <div className="items-center align-middle pr-2 flex">
        {warn ? (
          <ExclamationTriangleIcon className="text-orange-500" />
        ) : (
          <InfoCircledIcon className="text-current" />
        )}
      </div>
      <div className="grow text-gray-500 text-sm align-middle">{children}</div>
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
