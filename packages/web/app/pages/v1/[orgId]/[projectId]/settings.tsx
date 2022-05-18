import React from 'react';
import 'twin.macro';
import { Settings } from '@/components/common/Settings';
import { ProjectView } from '@/components/project/View';
import { NameSettings } from '@/components/project/settings/Name';
import { DeleteSettings } from '@/components/project/settings/Delete';
import { GitRepositorySettings } from '@/components/project/settings/GitRepository';
import { ProjectFieldsFragment, OrganizationFieldsFragment } from '@/graphql';
import { useProjectAccess, ProjectAccessScope } from '@/lib/access/project';

const Inner: React.FC<{
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ project, organization }) => {
  const canAccess = useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: organization.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

  return (
    <Settings
      title="Settings"
      subtitle="Applies to all targets within the project"
    >
      <NameSettings project={project} />
      <GitRepositorySettings project={project} />
      <DeleteSettings />
    </Settings>
  );
};

export default function ProjectSettingsPage() {
  return (
    <ProjectView title="Settings">
      {({ project, organization }) => (
        <Inner project={project} organization={organization} />
      )}
    </ProjectView>
  );
}
