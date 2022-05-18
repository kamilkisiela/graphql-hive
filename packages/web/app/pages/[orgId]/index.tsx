import * as React from 'react';
import 'twin.macro';
import { OrganizationFieldsFragment } from '@/graphql';
import { Page } from '@/components/common';
import { OrganizationView } from '@/components/organization/View';
import { OrganizationProjects } from '@/components/organization/Projects';
import { OrganizationActivities } from '@/components/organization/Activities';
import { ProjectCreatorTrigger } from '@/components/project/Creator';
import {
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';

const Inner: React.FC<{ organization: OrganizationFieldsFragment }> = ({
  organization,
}) => {
  const canCreate = useOrganizationAccess({
    scope: OrganizationAccessScope.Read,
    member: organization?.me,
  });

  return (
    <Page
      title={organization.name}
      subtitle="An overview"
      actions={canCreate && <ProjectCreatorTrigger />}
    >
      <div tw="w-full flex flex-row">
        <div tw="flex-grow mr-12">
          <OrganizationProjects org={organization} />
        </div>
        <div tw="flex-grow-0 w-5/12">
          <OrganizationActivities />
        </div>
      </div>
    </Page>
  );
};

export default function OrganizationPage() {
  return (
    <OrganizationView title="Overview">
      {({ organization }) => <Inner organization={organization} />}
    </OrganizationView>
  );
}
