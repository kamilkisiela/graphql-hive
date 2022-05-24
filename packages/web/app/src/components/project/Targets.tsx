import * as React from 'react';
import 'twin.macro';
import Link from 'next/link';
import { useQuery } from 'urql';
import { CriticalityLevel, TargetsDocument, ProjectFieldsFragment, OrganizationFieldsFragment } from '@/graphql';
import { Card, Circle, Section } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { EmptyList } from '@/components/common/EmptyList';

export const ProjectTargets: React.FC<{
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
}> = ({ organization, project }) => {
  const [query] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
      },
    },
  });

  return (
    <DataWrapper query={query}>
      {() => {
        if (query.data.targets.total === 0) {
          return (
            <EmptyList
              title="Hive is waiting for your first target"
              description={`You can create a target by clicking the "New Target" button.`}
              documentationLink={`${process.env.NEXT_PUBLIC_DOCS_LINK}/get-started/targets`}
            />
          );
        }
        return (
          <>
            <Section.Title>Targets</Section.Title>
            <div tw="pt-6 flex flex-col space-y-6">
              {query.data.targets.nodes.map(target => (
                <Card.Root key={target.id}>
                  <Link href={`/${organization.cleanId}/${project.cleanId}/${target.cleanId}`}>
                    <Card.Title tw="flex items-center justify-between bg-white cursor-pointer">
                      {target.name}
                      <Circle criticality={CriticalityLevel.Safe} tw="mr-2" />
                    </Card.Title>
                  </Link>
                </Card.Root>
              ))}
            </div>
          </>
        );
      }}
    </DataWrapper>
  );
};
