import React from 'react';
import 'twin.macro';
import { Page } from '@/components/common';
import { Dashboard } from '@/components/project/persisted-operations/Dashboard';
import { ProjectView } from '@/components/project/View';
import { ProjectFieldsFragment, OrganizationFieldsFragment } from '@/graphql';
import { ProjectAccessScope, useProjectAccess } from '@/lib/access/project';

const Inner: React.FC<{
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ project, organization }) => {
  const canAccess = useProjectAccess({
    scope: ProjectAccessScope.OperationsStoreRead,
    member: organization.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

  return (
    <Page
      title="Operations Store"
      subtitle="Operations you persisted using the Hive CLI. The store can be used to improve security and performance."
      scrollable
    >
      <Dashboard project={project} organization={organization} />
    </Page>
  );
};

export default function PersistedOperationsPage() {
  return (
    <ProjectView title="Persisted Operations">
      {({ project, organization }) => <Inner project={project} organization={organization} />}
    </ProjectView>
  );
}
