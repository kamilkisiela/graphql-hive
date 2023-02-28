import { getDocsUrl } from '@/lib/docs-url';
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

export const DocsLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const fullUrl = getDocsUrl(href) || 'https://docs.graphql-hive.com/';

  return (
    <Link className="text-orange-500" href={fullUrl} target="_blank" rel="noreferrer">
      {children}
      <ExternalLinkIcon className="inline pl-1" />
    </Link>
  );
};
