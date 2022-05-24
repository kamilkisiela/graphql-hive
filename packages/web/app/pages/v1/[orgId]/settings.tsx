import React from 'react';
import 'twin.macro';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { Settings } from '@/components/common/Settings';
import { OrganizationView } from '@/components/organization/View';
import { DeleteSettings } from '@/components/organization/settings/Delete';
import { NameSettings } from '@/components/organization/settings/Name';
import { IntegrationsSettings } from '@/components/organization/settings/Integrations';
import { OrganizationFieldsFragment, OrganizationType } from '@/graphql';

const Inner: React.FC<{ organization: OrganizationFieldsFragment }> = ({ organization }) => {
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });
  const canAccessIntegrations = useOrganizationAccess({
    scope: OrganizationAccessScope.Integrations,
    member: organization?.me,
    redirect: false,
  });

  if (!canAccess) {
    return null;
  }

  const isRegular = organization.type === OrganizationType.Regular;

  return (
    <Settings title="Settings" subtitle="Applies to all projects and targets within the organization">
      {isRegular && <NameSettings organization={organization} />}
      {canAccessIntegrations && <IntegrationsSettings organization={organization} />}
      {isRegular && <DeleteSettings />}
    </Settings>
  );
};

export default function OrganizationSettingsPage() {
  return (
    <OrganizationView title="Settings">{({ organization }) => <Inner organization={organization} />}</OrganizationView>
  );
}
