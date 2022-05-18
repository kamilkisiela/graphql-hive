import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import { useQuery } from 'urql';

import { useUser } from '@/components/auth/AuthProvider';
import { Avatar, Button, DropdownMenu, HiveLink } from '@/components/v2';
import {
  ArrowDownIcon,
  CalendarIcon,
  FileTextIcon,
  GridIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
} from '@/components/v2/icon';
import { CreateOrganizationModal } from '@/components/v2/modals';
import {
  MeDocument,
  OrganizationsDocument,
  OrganizationsQuery,
  OrganizationType,
} from '@/graphql';

type DropdownOrganization = OrganizationsQuery['organizations']['nodes'];

export const Header = ({ children, ...props }): ReactElement => {
  const [meQuery] = useQuery({ query: MeDocument });
  const { user } = useUser();
  const [organizationsQuery] = useQuery({ query: OrganizationsDocument });
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen((prevOpen) => !prevOpen);
  }, []);

  const me = meQuery.data?.me;
  const { personal, organizations } = (
    organizationsQuery.data?.organizations.nodes || []
  ).reduce<{
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

  return (
    <header
      className={`
        after:-z-1
        relative
        after:absolute
        after:inset-x-0
        after:top-0
        after:bottom-[-46px]
        after:border-b
        after:border-gray-800
        after:content-['']
      `}
      {...props}
    >
      <style jsx>{`
        header::after {
          background: url(/images/bg-top-shine.svg) no-repeat left top,
            url(/images/bg-bottom-shine.svg) no-repeat right bottom;
        }
      `}</style>

      <div className="wrapper flex h-[84px] items-center justify-between">
        <HiveLink />
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button>
              <ArrowDownIcon className="h-5 w-5 text-gray-500" />
              <Avatar
                src={user.picture}
                shape="circle"
                className="ml-2.5 border-2 border-gray-900"
              />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Content sideOffset={5} align="end">
            <DropdownMenu.Label className="line-clamp-1 mb-2 max-w-[250px] px-2">
              {me?.displayName}
            </DropdownMenu.Label>
            <DropdownMenu>
              <DropdownMenu.TriggerItem>
                <GridIcon />
                Switch organization
                <ArrowDownIcon className="ml-10 -rotate-90 text-white" />
              </DropdownMenu.TriggerItem>
              <DropdownMenu.Content sideOffset={25} className="max-w-[300px]">
                <DropdownMenu.Label className="px-2 text-xs font-bold text-gray-500">
                  PERSONAL
                </DropdownMenu.Label>
                {personal.map((org) => (
                  <DropdownMenu.Item key={org.cleanId} className="!p-0">
                    <NextLink href={`/${org.cleanId}`}>
                      <a className="grow py-2.5 px-2">{org.name}</a>
                    </NextLink>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Label className="px-2 text-xs font-bold text-gray-500">
                  OUTERS ORGANIZATIONS
                </DropdownMenu.Label>
                {organizations.map((org) => (
                  <DropdownMenu.Item key={org.cleanId} className="!p-0">
                    <NextLink href={`/${org.cleanId}`} passHref>
                      <a className="line-clamp-1 grow py-2.5 px-2">
                        {org.name}
                      </a>
                    </NextLink>
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
              <a
                href={process.env.NEXT_PUBLIC_DOCS_LINK}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarIcon />
                Schedule a meeting
              </a>
            </DropdownMenu.Item>
            <NextLink href="/settings">
              <a>
                <DropdownMenu.Item>
                  <SettingsIcon />
                  Profile settings
                </DropdownMenu.Item>
              </a>
            </NextLink>
            <DropdownMenu.Item asChild>
              <a
                href="https://theguildoss.notion.site/Hive-Guide-c87818e1829349a89cc9209da61c0da1"
                target="_blank"
                rel="noreferrer"
              >
                <FileTextIcon />
                Documentation
              </a>
            </DropdownMenu.Item>
            {/* TODO: Light mode will be available after releasing */}
            {/*<DropdownMenu.Item>*/}
            {/*  <SunIcon />*/}
            {/*  Switch Light Theme*/}
            {/*</DropdownMenu.Item>*/}
            <NextLink href="/api/logout" passHref>
              <a>
                <DropdownMenu.Item>
                  <LogOutIcon />
                  Log out
                </DropdownMenu.Item>
              </a>
            </NextLink>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {children}

      <CreateOrganizationModal
        isOpen={isModalOpen}
        toggleModalOpen={toggleModalOpen}
      />
    </header>
  );
};
