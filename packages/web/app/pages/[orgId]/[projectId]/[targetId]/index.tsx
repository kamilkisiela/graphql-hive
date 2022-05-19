import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { VscBug, VscDiff, VscListFlat } from 'react-icons/vsc';
import { useQuery } from 'urql';
import reactStringReplace from 'react-string-replace';

import { Label } from '@/components/common';
import { TargetLayout } from '@/components/layouts';
import {
  Badge,
  Button,
  DiffEditor,
  Heading,
  noSchema,
  Spinner,
  TimeAgo,
  Title,
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/v2';
import { Link2Icon } from '@/components/v2/icon';
import { ConnectSchemaModal } from '@/components/v2/modals';
import {
  CompareDocument,
  SchemasDocument,
  SchemaVersionFieldsFragment,
  SchemaChangeFieldsFragment,
  VersionsDocument,
  CriticalityLevel,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

function labelize(message: string) {
  const findSingleQuotes = /'([^']+)'/gim;

  return reactStringReplace(message, findSingleQuotes, (match, i) => (
    <Label key={i}>{match}</Label>
  ));
}

const ChangesBlock: React.FC<{
  changes: SchemaChangeFieldsFragment[];
  criticality: CriticalityLevel;
}> = ({ changes, criticality }) => {
  const titleMap: Record<CriticalityLevel, string> = {
    Safe: 'Safe Changes',
    Breaking: 'Breaking Changes',
    Dangerous: 'Dangerous Changes',
  };

  const filteredChanges = changes.filter((c) => c.criticality === criticality);

  if (!filteredChanges.length) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
        {titleMap[criticality]}
      </h2>
      <ul className="list-inside list-disc pl-3 text-base leading-relaxed">
        {filteredChanges.map((change, key) => (
          <li
            key={key}
            className={clsx(
              criticality === CriticalityLevel.Safe
                ? 'text-emerald-400'
                : criticality === CriticalityLevel.Dangerous
                ? 'text-yellow-400'
                : 'text-red-400'
            )}
          >
            <span className="text-gray-600 dark:text-white">
              {labelize(change.message)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const DiffView = ({ view }: { view: 'sdl' | 'list' }): ReactElement => {
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

  if (view === 'sdl') {
    return <DiffEditor before={before} after={after} />;
  }

  return (
    <div className="space-y-3 p-6">
      <ChangesBlock
        changes={comparison.changes.nodes}
        criticality={CriticalityLevel.Breaking}
      />
      <ChangesBlock
        changes={comparison.changes.nodes}
        criticality={CriticalityLevel.Dangerous}
      />
      <ChangesBlock
        changes={comparison.changes.nodes}
        criticality={CriticalityLevel.Safe}
      />
    </div>
  );
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

  const [view, setView] = useState<'sdl' | 'list'>('list');
  const onViewChange = useCallback(
    (view: any) => {
      setView(view);
    },
    [setView]
  );

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
        <div className="mt-2.5 mb-1.5 flex align-middle text-xs font-medium text-[#c4c4c4]">
          <div className={clsx('w-1/2 ', !version.valid && 'text-red-500')}>
            <Badge color={version.valid ? 'green' : 'red'} /> Published{' '}
            <TimeAgo date={version.date} />
          </div>

          {version.commit.service && (
            <div className="ml-auto mr-0 w-1/2  overflow-hidden text-ellipsis whitespace-nowrap text-right font-bold">
              {version.commit.service}
            </div>
          )}
        </div>
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
        <div className="mb-4 flex items-center justify-between">
          <Heading>Schema</Heading>
          <ToggleGroup
            defaultValue="diff"
            onValueChange={onViewChange}
            type="single"
            className="bg-gray-900/50 text-gray-500"
          >
            <ToggleGroupItem
              className={clsx(
                'hover:text-white',
                view === 'sdl' ? 'bg-gray-800 text-white' : null
              )}
              value="sdl"
            >
              <VscDiff />
            </ToggleGroupItem>
            <ToggleGroupItem
              className={clsx(
                'hover:text-white',
                view === 'list' ? 'bg-gray-800 text-white' : null
              )}
              value="list"
            >
              <VscListFlat />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex h-[65vh] grow overflow-hidden rounded-md border border-gray-800/50">
          <DiffView view={view} />
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
