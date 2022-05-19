import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import { SchemaEditor } from '@theguild/editor';
import clsx from 'clsx';
import { VscBug } from 'react-icons/vsc';
import { useQuery } from 'urql';

import { TargetLayout } from '@/components/layouts';
import {
  Badge,
  Button,
  DiffEditor,
  Heading,
  Link,
  noSchema,
  prettify,
  Spinner,
  TimeAgo,
  Title,
} from '@/components/v2';
import { Link2Icon } from '@/components/v2/icon';
import { ConnectSchemaModal } from '@/components/v2/modals';
import {
  CompareDocument,
  SchemasDocument,
  SchemaVersionFieldsFragment,
  VersionsDocument,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const DiffView = (): ReactElement => {
  const router = useRouteSelector();
  const [compareQuery] = useQuery({
    query: CompareDocument,
    variables: {
      organization: router.organizationId,
      project: router.projectId,
      target: router.targetId,
      version: router.versionId,
    },
  });
  const comparison = compareQuery.data?.schemaCompareToPrevious;

  if (!comparison) {
    return null;
  }

  if (comparison.__typename === 'SchemaCompareError') {
    return (
      <div className="m-3 grow rounded-lg bg-red-500/20 p-8">
        <div className="mb-3 flex items-center">
          <VscBug className="mr-3 h-8 w-8 text-red-500" />
          <h2 className="text-lg font-medium text-white">
            Failed to build GraphQL Schema
          </h2>
        </div>
        <div className="grow">
          <p className="text-base text-gray-500">
            Schema is most likely incomplete and was force published
          </p>
        </div>
      </div>
    );
  }

  const { before, after } = comparison.diff;

  return <DiffEditor before={before} after={after} />;
};

export default function SchemaPage(): ReactElement {
  const router = useRouteSelector();
  const [after, setAfter] = useState<null | string>(null);
  const selector = {
    organization: router.organizationId,
    project: router.projectId,
    target: router.targetId,
  };
  const [schemasQuery] = useQuery({
    query: SchemasDocument,
    variables: {
      selector,
    },
    requestPolicy: 'cache-and-network',
  });
  const [versionsQuery] = useQuery({
    query: VersionsDocument,
    variables: {
      selector,
      limit: 10,
      after,
    },
    requestPolicy: 'cache-and-network',
  });

  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);

  if (schemasQuery.fetching) {
    return <Spinner className="mt-10" />;
  }

  const schema = schemasQuery.data.target.latestSchemaVersion?.schemas.nodes[0];

  if (!schema) {
    return (
      <TargetLayout value="schema" className="flex flex-col gap-5">
        <div>
          <Button size="large" variant="primary" onClick={toggleModalOpen}>
            Connect
            <Link2Icon className="ml-8" />
          </Button>
        </div>
        <ConnectSchemaModal
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
        />
        {noSchema}
      </TargetLayout>
    );
  }

  const schemaVersions = versionsQuery.data?.schemaVersions;
  const baseUrl = `/${router.organizationId}/${router.projectId}/${router.targetId}`;

  const renderVersion = (version: SchemaVersionFieldsFragment) => (
    <NextLink
      key={version.id}
      href={`${baseUrl}/history/${version.id}`}
      passHref
    >
      <a
        className={clsx(
          'flex flex-col rounded-md p-2.5 hover:bg-gray-800/40',
          router.versionId &&
            router.versionId === version.id &&
            'bg-gray-800/40'
        )}
      >
        <h3 className="truncate font-bold">{version.commit.commit}</h3>
        <div className="truncate text-xs font-medium text-gray-500">
          <span className="overflow-hidden truncate">
            {version.commit.author}
          </span>
        </div>
        <span
          className={clsx(
            'mt-2.5 mb-1.5 text-xs font-medium text-[#c4c4c4]',
            !version.valid && 'text-red-500'
          )}
        >
          <Badge color={version.valid ? 'green' : 'red'} /> Published{' '}
          <TimeAgo date={version.date} />
        </span>
      </a>
    </NextLink>
  );
  const hasMore = versionsQuery.data?.schemaVersions.pageInfo.hasMore;

  const [lastVersion, ...versions] = schemaVersions ? schemaVersions.nodes : [];

  return (
    <TargetLayout
      value="schema"
      className="flex h-full items-stretch gap-x-5 pb-10"
    >
      <Title title="Schema" />
      <div className="w-[355px]">
        <div className="mb-4 flex items-end">
          <Heading>Versions</Heading>
        </div>
        <div className="flex h-[65vh] flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 p-2.5">
          {schemaVersions && renderVersion(lastVersion)}
          {versions.length > 0 && versions.map(renderVersion)}
          {hasMore && (
            <Button
              variant="link"
              onClick={() => {
                setAfter(schemaVersions.nodes.at(-1).id);
              }}
            >
              Load more
            </Button>
          )}
        </div>
      </div>
      <div className="grow">
        <div className="mb-4 flex items-end">
          <Heading>Simple DirectMedia Layer</Heading>
          <NextLink
            href={
              router.versionId || !schemaVersions
                ? baseUrl
                : `${baseUrl}/history/${schemaVersions.nodes[0].id}`
            }
            passHref
          >
            <Link
              variant={router.versionId ? 'primary' : 'secondary'}
              className="ml-auto mr-2.5 text-xs"
            >
              Diff view
            </Link>
          </NextLink>
          {/*<Link href="#" className="text-xs">*/}
          {/*  Search*/}
          {/*</Link>*/}
        </div>
        <div className="flex h-[65vh] grow overflow-hidden rounded-md border border-gray-800/50">
          {router.versionId ? (
            <DiffView />
          ) : (
            <SchemaEditor
              theme="vs-dark"
              options={{ readOnly: true }}
              height="100%"
              // TODO: improve, use useMemo
              schema={prettify(schema.source)}
            />
          )}
          <style jsx global>{`
            .monaco-editor,
            .monaco-editor-background,
            [role='presentation'] {
              background: transparent !important;
            }
          `}</style>
        </div>
      </div>
    </TargetLayout>
  );
}
