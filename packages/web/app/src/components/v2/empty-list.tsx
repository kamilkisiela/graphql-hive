import { ReactElement } from 'react';
import Image from 'next/image';

import { Card, Heading, Link } from '@/components/v2/index';
import { getDocsUrl } from '@/lib/docs-url';
import magnifier from '../../../public/images/figures/magnifier.svg';

export const EmptyList = ({
  title,
  description,
  docsUrl,
}: {
  title: string;
  description: string;
  docsUrl: string | null;
}): ReactElement => {
  return (
    <Card className="flex grow flex-col items-center gap-y-2">
      <Image
        src={magnifier}
        alt="Magnifier illustration"
        width="200"
        height="200"
        className="drag-none"
      />
      <Heading>{title}</Heading>
      <span className="text-center text-sm font-medium text-gray-500">{description}</span>
      {docsUrl === null ? null : (
        <Link variant="primary" href={docsUrl} target="_blank" rel="noreferrer" className="my-5">
          Read about it in the documentation
        </Link>
      )}
    </Card>
  );
};

export const noSchema = (
  <EmptyList
    title="Hive is waiting for your first schema"
    description="You can publish a schema with Hive CLI and Hive Client"
    docsUrl={getDocsUrl(`/features/publish-schema`)}
  />
);
