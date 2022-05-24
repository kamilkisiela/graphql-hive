import React from 'react';
import { VscBeaker, VscGitCommit, VscHistory, VscRadioTower, VscSettings } from 'react-icons/vsc';
import { useQuery } from 'urql';

import { Title } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { useNavigation } from '@/components/common/Navigation';
import { OrganizationFieldsFragment, ProjectFieldsFragment, TargetDocument, TargetQuery } from '@/graphql';
import { TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const TargetView: React.FC<{
  title: string;
  children: React.FC<{
    organization: OrganizationFieldsFragment;
    project: ProjectFieldsFragment;
    target: TargetQuery['target'];
  }>;
}> = ({ children, title }) => {
  const { setNavigation } = useNavigation();
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetDocument,
    variables: {
      organizationId: router.organizationId,
      targetId: router.targetId,
      projectId: router.projectId,
    },
  });

  const organizationCleanId = query.data?.organization?.organization?.cleanId;
  const projectCleanId = query.data?.project?.cleanId;
  const targetCleanId = query.data?.target?.cleanId;

  const canAccessSettings = useTargetAccess({
    scope: TargetAccessScope.Settings,
    member: query.data?.organization?.organization.me,
  });
  const canAccessSchema = useTargetAccess({
    scope: TargetAccessScope.RegistryRead,
    member: query.data?.organization?.organization.me,
    redirect: true,
  });

  React.useEffect(() => {
    if (projectCleanId && targetCleanId && organizationCleanId) {
      setNavigation({
        organization: organizationCleanId,
        project: projectCleanId,
        target: targetCleanId,
        menuTitle: 'Target',
        menu: [
          canAccessSchema && {
            exact: true,
            label: 'Schema',
            link: `/${router.organizationId}/${router.projectId}/${router.targetId}`,
            icon: <VscGitCommit />,
          },
          canAccessSchema && {
            label: 'History',
            link: `/${router.organizationId}/${router.projectId}/${router.targetId}/history`,
            icon: <VscHistory />,
          },
          canAccessSchema && {
            label: 'Operations',
            link: `/${router.organizationId}/${router.projectId}/${router.targetId}/operations`,
            icon: <VscRadioTower />,
          },
          canAccessSchema && {
            label: 'Laboratory',
            link: `/${router.organizationId}/${router.projectId}/${router.targetId}/lab`,
            icon: <VscBeaker />,
          },
          canAccessSettings && {
            label: 'Settings',
            link: `/${router.organizationId}/${router.projectId}/${router.targetId}/settings`,
            icon: <VscSettings />,
          },
        ],
      });
    }
  }, [
    organizationCleanId,
    projectCleanId,
    targetCleanId,
    setNavigation,
    canAccessSettings,
    canAccessSchema,
    router.organizationId,
    router.projectId,
    router.targetId,
  ]);

  const organizationName = query.data?.organization?.organization?.name;
  const projectName = query.data?.project?.name;
  const targetName = query.data?.target?.name;
  const pageTitle =
    organizationName && projectName && targetName
      ? `${title} - ${targetName} ${projectName} / ${organizationName}`
      : title;

  return (
    <>
      <Title title={pageTitle} />
      <DataWrapper query={query}>
        {() => (
          <>
            {children({
              organization: query.data.organization.organization,
              project: query.data.project,
              target: query.data.target,
            })}
          </>
        )}
      </DataWrapper>
    </>
  );
};
