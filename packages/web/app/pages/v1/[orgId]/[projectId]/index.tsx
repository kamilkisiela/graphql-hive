import * as React from 'react';
import 'twin.macro';
import { OrganizationFieldsFragment, ProjectFieldsFragment } from '@/graphql';
import { Page } from '@/components/common';
import { ProjectView } from '@/components/project/View';
import { ProjectTargets } from '@/components/project/Targets';
import { ProjectActivities } from '@/components/project/Activities';
import { TargetCreatorTrigger } from '@/components/target/Creator';
import { ProjectAccessScope, useProjectAccess } from '@/lib/access/project';

const Inner: React.FC<{
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ project, organization }) => {
  const canCreate = useProjectAccess({
    scope: ProjectAccessScope.Read,
    member: organization.me,
  });

  return (
    <Page title={project.name} subtitle="An overview" actions={canCreate && <TargetCreatorTrigger />}>
      <div tw="w-full flex flex-row">
        <div tw="flex-grow mr-12">
          <ProjectTargets project={project} organization={organization} />
        </div>
        <div tw="flex-grow-0 w-5/12">
          <ProjectActivities />
        </div>
      </div>
    </Page>
  );
};

export default function ProjectPage() {
  return (
    <ProjectView title="Overview">
      {({ project, organization }) => <Inner project={project} organization={organization} />}
    </ProjectView>
  );
}
