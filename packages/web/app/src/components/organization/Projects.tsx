import * as React from 'react';
import 'twin.macro';
import { useQuery } from 'urql';
import { OrganizationFieldsFragment, ProjectsWithTargetsDocument } from '@/graphql';
import { EmptyList } from '@/components/common/EmptyList';
import { DataWrapper } from '@/components/common/DataWrapper';
import { Section } from '@/components/common';
import { ProjectCard } from '@/components/project/Card';

export const OrganizationProjects: React.FC<{
  org: OrganizationFieldsFragment;
}> = ({ org }) => {
  const [query] = useQuery({
    query: ProjectsWithTargetsDocument,
    variables: {
      selector: {
        organization: org.cleanId,
      },
    },
  });

  return (
    <DataWrapper query={query}>
      {() => {
        if (query.data.projects.total === 0) {
          return (
            <EmptyList
              title="Hive is waiting for your first project"
              description={`You can create a project by clicking the "New Project" button.`}
              documentationLink={`${process.env.NEXT_PUBLIC_DOCS_LINK}/get-started/projects`}
            />
          );
        }

        return (
          <>
            <Section.Title>Projects</Section.Title>
            <div tw="pt-6 flex flex-col space-y-6">
              {query.data.projects.nodes.map(project => (
                <ProjectCard key={project.id} org={org} project={project} targets={project.targets.nodes} />
              ))}
            </div>
          </>
        );
      }}
    </DataWrapper>
  );
};
