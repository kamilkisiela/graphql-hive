import { ReactElement, useEffect, useState } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { useQuery } from 'urql';
import { GetStartedProgress } from '@/components/get-started/wizard';
import { Avatar, Button, HiveLink } from '@/components/v2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/v2/dropdown';
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
import { env } from '@/env/frontend';
import { MeDocument, OrganizationsDocument } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useRouteSelector } from '@/lib/hooks';

export function Header(): ReactElement {
  const router = useRouteSelector();
  const [meQuery] = useQuery({ query: MeDocument });
  const [organizationsQuery] = useQuery({ query: OrganizationsDocument });
  const [isOpaque, setIsOpaque] = useState(false);

  const me = meQuery.data?.me;
  const organizations = organizationsQuery.data?.organizations.nodes || [];

  const currentOrg =
    typeof router.organizationId === 'string'
      ? organizations.find(org => org.cleanId === router.organizationId)
      : null;

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

  const docsUrl = getDocsUrl();
  return (
    <header
      className={clsx(
        'fixed top-0 z-40 w-full border-b border-b-transparent transition',
        isOpaque && 'border-b-gray-900 bg-black/80 backdrop-blur',
      )}
    >
      <div className="container flex h-[84px] items-center justify-between">
        <HiveLink />
        <div className="flex flex-row gap-8">
          {currentOrg?.getStarted ? <GetStartedProgress tasks={currentOrg.getStarted} /> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <ArrowDownIcon className="h-5 w-5 text-gray-500" />
                <Avatar shape="circle" className="border-2 border-gray-900" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent sideOffset={5} align="end">
              <DropdownMenuLabel className="mb-2 w-64 px-2 truncate">
                {me?.displayName}
              </DropdownMenuLabel>
              <DropdownMenuSub>
                {me?.canSwitchOrganization ? (
                  <DropdownMenuSubTrigger>
                    <GridIcon className="h-5 w-5" />
                    Switch organization
                    <ArrowDownIcon className="ml-10 -rotate-90 text-white" />
                  </DropdownMenuSubTrigger>
                ) : null}
                <DropdownMenuSubContent sideOffset={25} className="max-w-[300px]">
                  {organizations.length ? (
                    <DropdownMenuLabel className="px-2 mb-2 text-xs font-bold text-gray-500 truncate !block">
                      ORGANIZATIONS
                    </DropdownMenuLabel>
                  ) : null}
                  {organizations.map(org => (
                    <NextLink href={`/${org.cleanId}`} key={org.cleanId}>
                      <DropdownMenuItem
                        className={`truncate !block ${
                          currentOrg?.name === org.name
                            ? 'bg-gray-700 text-gray-100 pointer-events-none'
                            : ''
                        }`}
                      >
                        {org.name}
                      </DropdownMenuItem>
                    </NextLink>
                  ))}
                  <DropdownMenuSeparator />
                  <NextLink href="/org/new">
                    <DropdownMenuItem>
                      <PlusIcon className="h-5 w-5" />
                      Create an organization
                    </DropdownMenuItem>
                  </NextLink>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <a
                  href="https://cal.com/team/the-guild/graphql-hive-15m"
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarIcon className="h-5 w-5" />
                  Schedule a meeting
                </a>
              </DropdownMenuItem>

              <NextLink href="/settings">
                <DropdownMenuItem>
                  <SettingsIcon className="h-5 w-5" />
                  Profile settings
                </DropdownMenuItem>
              </NextLink>
              {docsUrl ? (
                <DropdownMenuItem asChild>
                  <a href={docsUrl} target="_blank" rel="noreferrer">
                    <FileTextIcon className="h-5 w-5" />
                    Documentation
                  </a>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <a href="https://status.graphql-hive.com" target="_blank" rel="noreferrer">
                  <AlertTriangleIcon className="h-5 w-5" />
                  Status page
                </a>
              </DropdownMenuItem>
              {meQuery.data?.me?.isAdmin && (
                <NextLink href="/manage">
                  <DropdownMenuItem>
                    <TrendingUpIcon className="h-5 w-5" />
                    Manage Instance
                  </DropdownMenuItem>
                </NextLink>
              )}
              {env.nodeEnv === 'development' && (
                <NextLink href="/dev">
                  <DropdownMenuItem>
                    <GraphQLIcon className="h-5 w-5" />
                    Dev GraphiQL
                  </DropdownMenuItem>
                </NextLink>
              )}
              <DropdownMenuItem asChild>
                <a href="/logout">
                  <LogOutIcon className="h-5 w-5" />
                  Log out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
