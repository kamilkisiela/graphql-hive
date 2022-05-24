import { FC } from 'react';
import { useRouter } from 'next/router';
import { SchemaEditor } from '@theguild/editor';
import clsx from 'clsx';
import { useQuery } from 'urql';

import { EmptyList, Heading, prettify, Spinner, TimeAgo, Title } from '@/components/v2';
import { PersistedOperationsDocument } from '@/graphql';

const OperationsStorePage: FC = () => {
  const router = useRouter();
  const [persistedOperationsQuery] = useQuery({
    query: PersistedOperationsDocument,
    variables: {
      selector: {
        organization: router.query.orgId,
        project: router.query.projectId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  if (persistedOperationsQuery.fetching) {
    return <Spinner className="mt-10" />;
  }

  const { persistedOperations } = persistedOperationsQuery.data;

  const [href, operation] = router.asPath.split('?');
  const operationId = new URLSearchParams(operation).get('operation');
  const selectedOperation = persistedOperations.nodes.find(node => node.id === operationId);

  return (
    <div className="flex h-full items-stretch gap-x-5 pb-10">
      <Title title="Persisted operations" />
      {persistedOperations.total === 0 ? (
        <EmptyList
          title="Hive is waiting for your first persisted operation"
          description="You can persist operations using Hive CLI"
          docsUrl={`${process.env.NEXT_PUBLIC_DOCS_LINK}/features/persisted-operations`}
        />
      ) : (
        <>
          <div className="w-[355px]">
            <div className="mb-4 flex items-end">
              <Heading>Persisted operations</Heading>
            </div>
            <div className="flex h-[65vh] flex-col gap-2.5 overflow-scroll rounded-[20px] border border-gray-800/50 p-2.5">
              {persistedOperations.nodes.map(node => (
                <button
                  key={node.id}
                  className={clsx(
                    'flex items-center gap-x-1.5 truncate rounded-[5px] p-3 text-left text-xs font-medium text-gray-500 hover:bg-gray-800/40',
                    selectedOperation && selectedOperation.id === node.id && 'bg-gray-800/40'
                  )}
                  onClick={() => {
                    router.push(`${href}?operation=${node.id}`);
                  }}
                >
                  <span className="grow">
                    {node.operationHash.slice(0, 7)}_{node.name}
                  </span>
                  {node.kind}
                  <span className="select-none font-medium text-gray-800">•</span>
                  <TimeAgo date={new Date().toISOString()} />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-11 flex h-[65vh] grow overflow-hidden rounded-[20px] border border-gray-800/50">
            {selectedOperation && (
              <SchemaEditor
                theme="vs-dark"
                options={{ readOnly: true }}
                height="100%"
                // TODO: improve, use useMemo
                schema={prettify(selectedOperation.content)}
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
        </>
      )}
    </div>
  );
};

export default OperationsStorePage;
