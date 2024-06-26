import { useCallback, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  LogInIcon,
  PlusIcon,
  SettingsIcon,
  SirenIcon,
  UserRoundPlusIcon,
  UsersIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { FragmentType, graphql, useFragment } from '@/gql';
import { getDocsUrl } from '@/lib/docs-url';
import { useRouter } from '@tanstack/react-router';
import { useCommand } from './shared';

const OrganizationCMDK_ProjectFragment = graphql(`
  fragment OrganizationCMDK_ProjectFragment on Project {
    id
    name
    cleanId
  }
`);

const OrganizationCMDK_OrganizationFragment = graphql(`
  fragment OrganizationCMDK_OrganizationFragment on Organization {
    id
    name
    cleanId
  }
`);

export function OrganizationCMDK(props: {
  organizationId: string;
  openCreateProjectModal: () => void;
  projects: FragmentType<typeof OrganizationCMDK_ProjectFragment>[] | null;
  organizations: FragmentType<typeof OrganizationCMDK_OrganizationFragment>[] | null;
}) {
  const cmd = useCommand();
  const [cmdPage, setCmdPage] = useState<'root' | 'projects' | 'organizations'>('root');
  const docsUrl = getDocsUrl();
  const router = useRouter();

  const projects = useFragment(OrganizationCMDK_ProjectFragment, props.projects) ?? [];
  const organizations =
    useFragment(OrganizationCMDK_OrganizationFragment, props.organizations) ?? [];

  const goBack = useCallback(() => {
    setCmdPage('root');
  }, [setCmdPage]);

  const goToProjects = useCallback(() => {
    setCmdPage('projects');
  }, [setCmdPage]);

  const goToOrganizations = useCallback(() => {
    setCmdPage('organizations');
  }, [setCmdPage]);

  const placeholders = {
    root: 'Type a command or search...',
    projects: 'Search projects...',
    organizations: 'Search organizations...',
  };

  return (
    <CommandDialog open={cmd.isOpen} onOpenChange={cmd.toggle}>
      <CommandInput placeholder={placeholders[cmdPage]} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {cmdPage === 'projects' ? (
          <>
            <CommandGroup>
              <CommandItem onSelect={goBack}>
                <ArrowLeftIcon className="mr-2 h-4 w-4" /> Go back
              </CommandItem>
              {projects.map(project => (
                <CommandItem
                  value={project.id}
                  onSelect={() => {
                    router.navigate({
                      to: '/$organizationId/$projectId',
                      params: {
                        organizationId: props.organizationId,
                        projectId: project.cleanId,
                      },
                    });
                  }}
                  key={project.id}
                >
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {cmdPage === 'organizations' ? (
          <>
            <CommandGroup>
              <CommandItem onSelect={goBack}>
                <ArrowLeftIcon className="mr-2 h-4 w-4" /> Go back
              </CommandItem>
              {organizations.map(organization => (
                <CommandItem
                  value={organization.id}
                  onSelect={() => {
                    router.navigate({
                      to: '/$organizationId',
                      params: {
                        organizationId: organization.cleanId,
                      },
                    });
                  }}
                  key={organization.id}
                >
                  {organization.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {cmdPage === 'root' ? (
          <>
            <CommandGroup heading="Organization">
              <CommandItem onSelect={goToOrganizations}>
                <ArrowLeftRightIcon className="mr-2 h-4 w-4" /> Switch organization
              </CommandItem>
              <CommandItem onSelect={goToProjects}>
                <LogInIcon className="mr-2 h-4 w-4" /> Search project...
              </CommandItem>
              <CommandItem onSelect={props.openCreateProjectModal}>
                <PlusIcon className="mr-2 h-4 w-4" /> Create new project
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  void router.navigate({
                    to: '/$organizationId/view/members',
                    params: {
                      organizationId: props.organizationId,
                    },
                    search: { page: 'invitations' },
                    hash: 'invite',
                  });
                }}
              >
                <UserRoundPlusIcon className="mr-2 h-4 w-4" /> Invite a member
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Pages">
              <CommandItem
                onSelect={() => {
                  router.navigate({
                    to: '/$organizationId',
                    params: {
                      organizationId: props.organizationId,
                    },
                  });
                }}
              >
                <LayoutDashboardIcon className="mr-2 h-4 w-4" /> Go to Overview
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  void router.navigate({
                    to: '/$organizationId/view/members',
                    params: {
                      organizationId: props.organizationId,
                    },
                    search: { page: 'list' },
                  });
                }}
              >
                <UsersIcon className="mr-2 h-4 w-4" /> Go to Members
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  router.navigate({
                    to: '/$organizationId/view/policy',
                    params: {
                      organizationId: props.organizationId,
                    },
                  });
                }}
              >
                <SirenIcon className="mr-2 h-4 w-4" /> Go to Policy
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  router.navigate({
                    to: '/$organizationId/view/settings',
                    params: {
                      organizationId: props.organizationId,
                    },
                  });
                }}
              >
                <SettingsIcon className="mr-2 h-4 w-4" /> Go to Settings
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  router.navigate({
                    to: '/$organizationId/view/subscription/manage',
                    params: {
                      organizationId: props.organizationId,
                    },
                  });
                }}
              >
                <CreditCardIcon className="mr-2 h-4 w-4" /> Manage Subscription
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Help">
              <CommandItem
                onSelect={() => {
                  window.location.href = 'https://cal.com/team/the-guild/graphql-hive-15m';
                }}
              >
                <CalendarDaysIcon className="mr-2 h-4 w-4" /> Schedule a meeting
              </CommandItem>
              {docsUrl ? (
                <CommandItem
                  onSelect={() => {
                    window.location.href = docsUrl;
                  }}
                >
                  <FileTextIcon className="mr-2 h-4 w-4" /> Visit documentation
                </CommandItem>
              ) : null}
              <CommandItem>
                <LifeBuoyIcon className="mr-2 h-4 w-4" /> Contact support
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
