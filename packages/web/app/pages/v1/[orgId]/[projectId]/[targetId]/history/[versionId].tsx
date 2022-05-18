import * as React from 'react';
import tw, { styled } from 'twin.macro';
import formatDate from 'date-fns/format';
import { useQuery } from 'urql';
import { Tooltip } from '@chakra-ui/react';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { CompareDocument, OrganizationFieldsFragment } from '@/graphql';
import { Page } from '@/components/common';
import { TextToggle } from '@/components/common/Toogle';
import { DataWrapper } from '@/components/common/DataWrapper';
import { TargetView } from '@/components/target/View';
import { Compare, View } from '@/components/target/history/Compare';
import { MarkAsValid } from '@/components/target/history/MarkAsValid';
import { useTargetAccess, TargetAccessScope } from '@/lib/access/target';

const Value = tw.div`text-base text-gray-900 dark:text-white`;
const ValueLabel = tw.div`text-xs text-gray-500 dark:text-gray-400`;
const Status = styled.span(({ valid }: { valid?: boolean }) => [
  tw`mx-auto my-2 block w-2 h-2 rounded-full`,
  valid ? tw`bg-emerald-400` : tw`bg-red-400`,
]);

const VersionView: React.FC<{
  organization: OrganizationFieldsFragment;
}> = ({ organization }) => {
  const router = useRouteSelector();
  const [view, setView] = React.useState<View>(View.Text);
  const [query] = useQuery({
    query: CompareDocument,
    variables: {
      organization: router.organizationId,
      project: router.projectId,
      target: router.targetId,
      version: router.versionId,
    },
  });
  const canModifyState = useTargetAccess({
    scope: TargetAccessScope.RegistryWrite,
    member: organization.me,
    redirect: false,
  });

  const version = query.data?.schemaVersion;

  return (
    <DataWrapper query={query}>
      {() => (
        <Page
          title={`Schema Version`}
          subtitle={version.id}
          scrollable
          actions={
            <>
              {canModifyState && <MarkAsValid version={version} />}
              <TextToggle
                left={{
                  label: 'Changes',
                  value: View.Text,
                }}
                right={{
                  label: 'Diff View',
                  value: View.Diff,
                }}
                selected={view}
                onSelect={setView}
              />
            </>
          }
        >
          <div tw="h-full flex flex-col">
            <div tw="mb-6 p-3 flex flex-row items-center space-x-12 bg-gray-100 dark:bg-gray-900 rounded-sm">
              <div>
                <Value title={version.date}>
                  {formatDate(new Date(version.date), 'yyyy-MM-dd HH:mm')}
                </Value>
                <ValueLabel>Published</ValueLabel>
              </div>

              <Tooltip
                label="Identifier of schema push action in your system, usually Git commit sha"
                fontSize="xs"
                placement="bottom-start"
              >
                <div>
                  <Value>{version.commit.commit}</Value>
                  <ValueLabel>Commit</ValueLabel>
                </div>
              </Tooltip>
              <Tooltip
                label="Author of the schema push action"
                fontSize="xs"
                placement="bottom-start"
              >
                <div>
                  <Value>{version.commit.author}</Value>
                  <ValueLabel>Author</ValueLabel>
                </div>
              </Tooltip>

              {version.commit.service && (
                <Tooltip
                  label="Source of schema change"
                  fontSize="xs"
                  placement="bottom-start"
                >
                  <div>
                    <Value>{version.commit.service}</Value>
                    <ValueLabel>Service</ValueLabel>
                  </div>
                </Tooltip>
              )}
              {version.valid && (
                <Tooltip
                  label={
                    version.valid
                      ? 'Composed successfully'
                      : 'Failed to compose'
                  }
                  fontSize="xs"
                  placement="bottom-start"
                >
                  <div>
                    <Value>
                      <Status valid={version.valid} />
                    </Value>
                    <ValueLabel>Status</ValueLabel>
                  </div>
                </Tooltip>
              )}
            </div>
            <div tw="flex-grow">
              <Compare
                view={view}
                comparison={query.data.schemaCompareToPrevious}
              />
            </div>
          </div>
        </Page>
      )}
    </DataWrapper>
  );
};

export default function TargetHistory() {
  return (
    <TargetView title="History">
      {({ organization }) => <VersionView organization={organization} />}
    </TargetView>
  );
}
