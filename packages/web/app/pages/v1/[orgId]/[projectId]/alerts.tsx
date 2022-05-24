import React from 'react';
import 'twin.macro';
import { OrganizationFieldsFragment } from '@/graphql';
import { Page } from '@/components/common';
import { ProjectView } from '@/components/project/View';
import { useProjectAccess, ProjectAccessScope } from '@/lib/access/project';
import { Alerts } from '@/components/project/alerts/Alerts';
import { Channels } from '@/components/project/alerts/Channels';

const Gate: React.FC<{
  organization: OrganizationFieldsFragment;
}> = ({ organization }) => {
  const canAccess = useProjectAccess({
    scope: ProjectAccessScope.Alerts,
    member: organization.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

  return (
    <Page title="Alerts" subtitle="Be always up to date with all the updates">
      <div tw="flex flex-col space-y-12 pt-6">
        <Channels />
        <Alerts />
      </div>
    </Page>
  );
};

export default function ProjectSettingsPage() {
  return <ProjectView title="Alerts">{({ organization }) => <Gate organization={organization} />}</ProjectView>;
}
