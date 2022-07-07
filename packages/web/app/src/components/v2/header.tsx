import { ReactElement, useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { useQuery } from 'urql';

import { useUser } from '@/components/auth/AuthProvider';
import { OnboardingProgress } from '@/components/onboarding/wizard';
import { Avatar, Button, DropdownMenu, HiveLink } from '@/components/v2';
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  CalendarIcon,
  FileTextIcon,
  GraphQLIcon,
  GridIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  TrendingUpIcon,
} from '@/components/v2/icon';
import { CreateOrganizationModal } from '@/components/v2/modals';
import { MeDocument, OrganizationsDocument, OrganizationsQuery, OrganizationType } from '@/graphql';
import { ManagerRoleGuard } from '../auth/ManagerRoleGuard';

type DropdownOrganization = OrganizationsQuery['organizations']['nodes'];

const OrganizationLink = (props: { children: string; href: string }): ReactElement => {
  return (
    <NextLink href={props.href} passHref>
      <a className="inline-block grow overflow-hidden text-ellipsis whitespace-nowrap py-2.5 px-2">{props.children}</a>
    </NextLink>
  );
};

export const Header = (): ReactElement => {
  const [meQuery] = useQuery({ query: MeDocument });
  const { user } = useUser();
  const [organizationsQuery] = useQuery({ query: OrganizationsDocument });
  const [isModalOpen, setModalOpen] = useState(false);
  const [isOpaque, setIsOpaque] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen(prevOpen => !prevOpen);
  }, []);

  const me = meQuery.data?.me;
  const { personal, organizations } = (organizationsQuery.data?.organizations.nodes || []).reduce<{
    personal: DropdownOrganization;
    organizations: DropdownOrganization;
  }>(
    (acc, node) => {
      if (node.type === OrganizationType.Personal) {
        acc.personal.push(node);
      } else {
        acc.organizations.push(node);
      }
      return acc;
    },
    { personal: [], organizations: [] }
  );

  // Copied from tailwindcss website
  // https://github.com/tailwindlabs/tailwindcss.com/blob/94971856747c159b4896621c3308bcfa629bb736/src/components/Header.js#L149
  useEffect(() => {
    const offset = 30;

    const onScroll = () => {
      if (!isOpaque && window.scrollY > offset) {
        setIsOpaque(true);
      } else if (isOpaque && window.scrollY <= offset) {
        setIsOpaque(false);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [isOpaque]);

  return (
    <header
      className={clsx(
        'fixed top-0 z-40 w-full border-b border-b-transparent transition',
        isOpaque && 'border-b-gray-900 bg-black/80 backdrop-blur'
      )}
    >
      <div className="container flex h-[84px] items-center justify-between">
        <HiveLink />
        <div className="flex flex-row gap-8">
          <OnboardingProgress />
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button>
                <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                <Avatar src={user?.picture} shape="circle" className="ml-2.5 border-2 border-gray-900" />
              </Button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content sideOffset={5} align="end">
              <DropdownMenu.Label className="line-clamp-1 mb-2 max-w-[250px] px-2">
                {me?.displayName}
              </DropdownMenu.Label>
              <DropdownMenu>
                <DropdownMenu.TriggerItem>
                  <GridIcon className="h-5 w-5" />
                  Switch organization
                  <ArrowDownIcon className="ml-10 -rotate-90 text-white" />
                </DropdownMenu.TriggerItem>
                <DropdownMenu.Content sideOffset={25} className="max-w-[300px]">
                  <DropdownMenu.Label className="px-2 text-xs font-bold text-gray-500">PERSONAL</DropdownMenu.Label>
                  {personal.map(org => (
                    <DropdownMenu.Item key={org.cleanId} className="!p-0">
                      <OrganizationLink href={`/${org.cleanId}`}>{org.name}</OrganizationLink>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Label className="px-2 text-xs font-bold text-gray-500">
                    OUTERS ORGANIZATIONS
                  </DropdownMenu.Label>
                  {organizations.map(org => (
                    <DropdownMenu.Item key={org.cleanId} className="!p-0">
                      <OrganizationLink href={`/${org.cleanId}`}>{org.name}</OrganizationLink>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item onSelect={toggleModalOpen}>
                    <PlusIcon className="h-5 w-5" />
                    Create an organization
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
              <DropdownMenu.Item asChild>
                <a href="https://calendly.com/d/zjjt-g8zd/hive-feedback" target="_blank" rel="noreferrer">
                  <CalendarIcon className="h-5 w-5" />
                  Schedule a meeting
                </a>
              </DropdownMenu.Item>

              <NextLink href="/settings">
                <a>
                  <DropdownMenu.Item>
                    <SettingsIcon className="h-5 w-5" />
                    Profile settings
                  </DropdownMenu.Item>
                </a>
              </NextLink>
              <DropdownMenu.Item asChild>
                <a href={process.env.NEXT_PUBLIC_DOCS_LINK} target="_blank" rel="noreferrer">
                  <FileTextIcon className="h-5 w-5" />
                  Documentation
                </a>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <a href="https://status.graphql-hive.com" target="_blank" rel="noreferrer">
                  <AlertTriangleIcon className="h-5 w-5" />
                  Status page
                </a>
              </DropdownMenu.Item>
              {/* TODO: Light mode will be available after releasing */}
              {/*<DropdownMenu.Item>*/}
              {/*  <SunIcon />*/}
              {/*  Switch Light Theme*/}
              {/*</DropdownMenu.Item>*/}
              {user?.metadata?.admin && (
                <ManagerRoleGuard>
                  <NextLink href="/manage">
                    <a>
                      <DropdownMenu.Item>
                        <TrendingUpIcon className="h-5 w-5" />
                        Manage Instance
                      </DropdownMenu.Item>
                    </a>
                  </NextLink>
                </ManagerRoleGuard>
              )}
              {process.env.NODE_ENV === 'development' && (
                <NextLink href="/dev">
                  <a>
                    <DropdownMenu.Item>
                      <GraphQLIcon className="h-5 w-5" />
                      Dev GraphiQL
                    </DropdownMenu.Item>
                  </a>
                </NextLink>
              )}
              <DropdownMenu.Item asChild>
                <a href="/api/logout">
                  <LogOutIcon className="h-5 w-5" />
                  Log out
                </a>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <CreateOrganizationModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
    </header>
  );
};
