import React from 'react';
import { useQuery } from 'urql';
import { VscBell, VscSettings, VscBook, VscProject } from 'react-icons/vsc';
import { ProjectFieldsFragment, ProjectDocument, OrganizationFieldsFragment } from '@/graphql';
import { useNavigation } from '@/components/common/Navigation';
import { ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { DataWrapper } from '@/components/common/DataWrapper';
import { Title } from '@/components/common';

export const ProjectView: React.FC<{
  title: string;
  children: React.FC<{
    project: ProjectFieldsFragment;
    organization: OrganizationFieldsFragment;
  }>;
}> = ({ children, title }) => {
  const { setNavigation } = useNavigation();
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ProjectDocument,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
  });

  const organizationCleanId = query.data?.organization?.organization?.cleanId;
  const projectCleanId = query.data?.project?.cleanId;

  const canAccessSettings = useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: query.data?.organization.organization.me,
  });
  const canAccessAlerts = useProjectAccess({
    scope: ProjectAccessScope.Alerts,
    member: query.data?.organization.organization.me,
  });

  React.useEffect(() => {
    if (organizationCleanId && projectCleanId) {
      setNavigation({
        organization: organizationCleanId,
        project: projectCleanId,
        menuTitle: 'Project',
        menu: [
          {
            exact: true,
            label: 'Dashboard',
            link: `/${router.organizationId}/${router.projectId}`,
            icon: <VscProject />,
          },
          {
            exact: true,
            label: 'Operations Store',
            link: `/${router.organizationId}/${router.projectId}/operations-store`,
            icon: <VscBook />,
          },
          canAccessAlerts && {
            label: 'Alerts',
            link: `/${router.organizationId}/${router.projectId}/alerts`,
            icon: <VscBell />,
          },
          canAccessSettings && {
            label: 'Settings',
            link: `/${router.organizationId}/${router.projectId}/settings`,
            icon: <VscSettings />,
          },
        ],
      });
    }
  }, [organizationCleanId, projectCleanId, setNavigation, canAccessSettings]);

  const projectName = query.data?.project?.name;
  const organizationName = query.data?.organization?.organization?.name;
  const pageTitle = projectName && organizationName ? `${title} - ${projectName} / ${organizationName}` : title;

  return (
    <>
      <Title title={pageTitle} />
      <DataWrapper query={query}>
        {() => (
          <>
            {children({
              project: query.data.project,
              organization: query.data.organization.organization,
            })}
          </>
        )}
      </DataWrapper>
    </>
  );
};
