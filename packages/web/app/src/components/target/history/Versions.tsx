import React from 'react';
import tw, { styled } from 'twin.macro';
import NextLink from 'next/link';
import { useQuery } from 'urql';
import { Button, Table, Tr, Td, Th } from '@chakra-ui/react';
import {
  VersionsDocument,
  VersionsQueryVariables,
  SchemaVersionsInput,
  SchemaVersionFieldsFragment,
} from '@/graphql';
import { TimeAgo } from '@/components/common';
import { NoSchemasYet } from '@/components/target/NoSchemasYet';
import { Spinner } from '@/components/common/Spinner';
import { QueryError } from '@/components/common/DataWrapper';

const Status = styled.span(({ valid }: { valid?: boolean }) => [
  tw`block w-2 h-2 rounded-full`,
  valid ? tw`bg-emerald-400` : tw`bg-red-400`,
]);

const Value = tw.div`text-base text-gray-900 dark:text-white`;
const ValueLabel = tw.div`text-xs text-gray-500 dark:text-gray-400`;

const Version: React.FC<{
  version: SchemaVersionFieldsFragment;
  organization: string;
  project: string;
  target: string;
}> = ({ version, organization, project, target }) => {
  return (
    <Tr>
      <Td
        tw="whitespace-nowrap px-4"
        title={version.valid ? 'Valid' : 'Invalid'}
      >
        <Status valid={version.valid} />
      </Td>
      <Td tw="whitespace-nowrap">
        <Value title={version.date}>
          <TimeAgo date={version.date} />
        </Value>
        <ValueLabel>Published</ValueLabel>
      </Td>
      <Td tw="w-full">
        <div tw="flex-grow overflow-x-hidden">
          <Value tw="overflow-ellipsis overflow-hidden">
            {version.commit.commit}
          </Value>
          <ValueLabel>Commit</ValueLabel>
        </div>
      </Td>
      <Td tw="whitespace-nowrap">
        <Value>{version.commit.author}</Value>
        <ValueLabel>Author</ValueLabel>
      </Td>
      <Td tw="whitespace-nowrap">
        {version.commit.service && (
          <>
            <Value>{version.commit.service}</Value>
            <ValueLabel>Service</ValueLabel>
          </>
        )}
      </Td>
      <Td tw="whitespace-nowrap">
        <div tw="flex flex-row items-center space-x-2 justify-end">
          <NextLink
            href={`/${organization}/${project}/${target}/history/${version.id}`}
            passHref
          >
            <Button as="a" size="sm" colorScheme="primary">
              View changes
            </Button>
          </NextLink>
        </div>
      </Td>
    </Tr>
  );
};

const limit = 15;

const VersionsPage: React.FC<{
  variables: VersionsQueryVariables;
  isLastPage: boolean;
  isFirstPage: boolean;
  onLoadMore(after: string): void;
  organization: string;
  project: string;
  target: string;
}> = ({
  variables,
  isFirstPage,
  isLastPage,
  onLoadMore,
  organization,
  project,
  target,
}) => {
  const [query] = useQuery({
    query: VersionsDocument,
    variables,
    requestPolicy: 'cache-and-network',
  });

  const hasMore = query.data?.schemaVersions.pageInfo.hasMore;
  const versions = query.data?.schemaVersions.nodes || [];

  if (isFirstPage) {
    if (query.fetching) {
      return <Spinner />;
    }

    if (query.error) {
      return <QueryError />;
    }

    if (!versions.length) {
      return <NoSchemasYet />;
    }
  }

  return (
    <>
      {versions.map((version) => {
        return (
          <Version
            key={version.id}
            version={version}
            organization={organization}
            project={project}
            target={target}
          />
        );
      })}
      {isLastPage && hasMore && (
        <Tr>
          <Th colSpan={6}>
            <Button
              tw="w-full"
              size="sm"
              variant="ghost"
              colorScheme="gray"
              onClick={() => {
                onLoadMore(versions[versions.length - 1].id);
              }}
            >
              Load more
            </Button>
          </Th>
        </Tr>
      )}
    </>
  );
};

export const Versions: React.FC<{
  selector: SchemaVersionsInput;
}> = ({ selector }) => {
  const [variables, setVariables] = React.useState<VersionsQueryVariables[]>([
    {
      selector,
      limit,
      after: null,
    },
  ]);

  const onLoadMore = React.useCallback(
    (after: string) => {
      setVariables([
        ...variables,
        {
          selector,
          limit,
          after,
        },
      ]);
    },
    [variables, setVariables]
  );

  return (
    <Table variant="simple" size="sm">
      {variables.map((v, i) => (
        <VersionsPage
          key={v.after + ''}
          variables={v}
          onLoadMore={onLoadMore}
          isFirstPage={i === 0}
          isLastPage={i === variables.length - 1}
          organization={selector.organization}
          project={selector.project}
          target={selector.target}
        />
      ))}
    </Table>
  );
};
