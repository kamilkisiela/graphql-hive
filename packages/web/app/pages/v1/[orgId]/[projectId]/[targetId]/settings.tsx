import React from 'react';
import 'twin.macro';
import { useQuery } from 'urql';
import { Settings } from '@/components/common/Settings';
import { DataWrapper } from '@/components/common/DataWrapper';
import { TargetView } from '@/components/target/View';
import { NameSettings } from '@/components/target/settings/Name';
import { DeleteSettings } from '@/components/target/settings/Delete';
import { TokensSettings } from '@/components/target/settings/Tokens';
import { ValidationSettings } from '@/components/target/settings/Validation';
import { BaseSchemaSettings } from '@/components/target/settings/BaseSchema';
import {
  OrganizationFieldsFragment,
  ProjectFieldsFragment,
  TargetFieldsFragment,
  TargetSettingsDocument,
} from '@/graphql';
import { useTargetAccess, TargetAccessScope } from '@/lib/access/target';

const Inner: React.FC<{
  target: TargetFieldsFragment;
  project: ProjectFieldsFragment;
  organization: OrganizationFieldsFragment;
}> = ({ target, project, organization }) => {
  const canAccess = useTargetAccess({
    scope: TargetAccessScope.Settings,
    member: organization.me,
    redirect: true,
  });
  const canAccessTokens = useTargetAccess({
    scope: TargetAccessScope.TokensRead,
    member: organization.me,
    redirect: false,
  });
  const [settings] = useQuery({
    query: TargetSettingsDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
      },
      targetsSelector: {
        organization: organization.cleanId,
        project: project.cleanId,
      },
    },
  });

  if (!canAccess) {
    return null;
  }

  return (
    <DataWrapper query={settings}>
      {() => (
        <Settings title="Settings" subtitle="Tokens and stuff">
          <NameSettings target={target} />
          {canAccessTokens && (
            <TokensSettings target={target} organization={organization} />
          )}
          <ValidationSettings
            target={target}
            possibleTargets={settings.data.targets.nodes}
            settings={settings.data.targetSettings.validation}
          />
          <BaseSchemaSettings target={target} />
          <DeleteSettings />
        </Settings>
      )}
    </DataWrapper>
  );
};

export default function TargetSettingsPage() {
  return (
    <TargetView title="Settings">
      {({ target, project, organization }) => (
        <Inner target={target} project={project} organization={organization} />
      )}
    </TargetView>
  );
}
