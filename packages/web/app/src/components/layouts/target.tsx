import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { LinkIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocsLink } from '@/components/ui/docs-note';
import { HiveLink } from '@/components/ui/hive-link';
import { Link as UiLink } from '@/components/ui/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserMenu } from '@/components/ui/user-menu';
import { CopyValue, Tag } from '@/components/v2';
import { graphql } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { canAccessTarget, TargetAccessScope, useTargetAccess } from '@/lib/access/target';
import { getDocsUrl } from '@/lib/docs-url';
import { useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { ProjectMigrationToast } from '../project/migration-toast';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { TargetSelector } from './target-selector';

export enum Page {
  Schema = 'schema',
  Explorer = 'explorer',
  Checks = 'checks',
  History = 'history',
  Insights = 'insights',
  Laboratory = 'laboratory',
  Apps = 'apps',
  Settings = 'settings',
}

const TargetLayoutQuery = graphql(`
  query TargetLayoutQuery {
    me {
      id
      ...UserMenu_MeFragment
    }
    organizations {
      nodes {
        id
        cleanId
        isAppDeploymentsEnabled
        me {
          id
          ...CanAccessTarget_MemberFragment
        }
        projects {
          nodes {
            id
            cleanId
            registryModel
            targets {
              nodes {
                id
                cleanId
              }
            }
          }
        }
      }
      ...TargetSelector_OrganizationConnectionFragment
      ...UserMenu_OrganizationConnectionFragment
    }
    isCDNEnabled
  }
`);

export const TargetLayout = ({
  children,
  connect,
  page,
  className,
  ...props
}: {
  page: Page;
  organizationId: string;
  projectId: string;
  targetId: string;
  className?: string;
  children: ReactNode;
  connect?: ReactNode;
}): ReactElement | null => {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: TargetLayoutQuery,
    requestPolicy: 'cache-first',
  });

  const { organizationId: orgId, projectId } = props;

  const me = query.data?.me;
  const currentOrganization = query.data?.organizations.nodes.find(
    node => node.cleanId === props.organizationId,
  );
  const currentProject = currentOrganization?.projects.nodes.find(
    node => node.cleanId === props.projectId,
  );
  const currentTarget = currentProject?.targets.nodes.find(node => node.cleanId === props.targetId);
  const isCDNEnabled = query.data?.isCDNEnabled === true;

  useTargetAccess({
    scope: TargetAccessScope.Read,
    member: currentOrganization?.me ?? null,
    redirect: true,
    targetId: props.targetId,
    projectId,
    organizationId: orgId,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.cleanId);

  const hasRegistryReadAccess = canAccessTarget(
    TargetAccessScope.RegistryRead,
    currentOrganization?.me ?? null,
  );
  const hasReadAccess = canAccessTarget(TargetAccessScope.Read, currentOrganization?.me ?? null);
  const hasSettingsAccess = canAccessTarget(
    TargetAccessScope.Settings,
    currentOrganization?.me ?? null,
  );
  const hasRegistryWriteAccess = canAccessTarget(
    TargetAccessScope.RegistryWrite,
    currentOrganization?.me ?? null,
  );
  const hasTokensWriteAccess = canAccessTarget(
    TargetAccessScope.TokensWrite,
    currentOrganization?.me ?? null,
  );

  const canAccessSettingsPage =
    hasReadAccess || hasSettingsAccess || hasRegistryWriteAccess || hasTokensWriteAccess;

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <TargetSelector
              organizations={query.data?.organizations ?? null}
              currentOrganizationCleanId={props.organizationId}
              currentProjectCleanId={props.projectId}
              currentTargetCleanId={props.targetId}
            />
          </div>
          <div>
            <UserMenu
              me={me ?? null}
              currentOrganizationCleanId={props.organizationId}
              organizations={query.data?.organizations ?? null}
            />
          </div>
        </div>
      </header>

      {currentProject?.registryModel === 'LEGACY' ? (
        <ProjectMigrationToast orgId={orgId} projectId={projectId} />
      ) : null}

      <div className="relative h-[--tabs-navbar-height] border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && currentProject && currentTarget ? (
            <Tabs className="flex h-full grow flex-col" value={page}>
              <TabsList variant="menu">
                {hasRegistryReadAccess && (
                  <>
                    <TabsTrigger variant="menu" value={Page.Schema} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Schema
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.Checks} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/checks"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Checks
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.Explorer} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/explorer"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Explorer
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.History} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/history"
                        params={{
                          organizationId: currentOrganization.cleanId,
                          projectId: currentProject.cleanId,
                          targetId: currentTarget.cleanId,
                        }}
                      >
                        History
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.Insights} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/insights"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Insights
                      </Link>
                    </TabsTrigger>
                    {currentOrganization.isAppDeploymentsEnabled && (
                      <TabsTrigger variant="menu" value={Page.Apps} asChild>
                        <Link
                          to="/$organizationId/$projectId/$targetId/apps"
                          params={{
                            organizationId: props.organizationId,
                            projectId: props.projectId,
                            targetId: props.targetId,
                          }}
                        >
                          Apps
                        </Link>
                      </TabsTrigger>
                    )}
                    <TabsTrigger variant="menu" value={Page.Laboratory} asChild>
                      <Link
                        to="/$organizationId/$projectId/$targetId/laboratory"
                        params={{
                          organizationId: props.organizationId,
                          projectId: props.projectId,
                          targetId: props.targetId,
                        }}
                      >
                        Laboratory
                      </Link>
                    </TabsTrigger>
                  </>
                )}
                {canAccessSettingsPage && (
                  <TabsTrigger variant="menu" value={Page.Settings} asChild>
                    <Link
                      to="/$organizationId/$projectId/$targetId/settings"
                      params={{
                        organizationId: props.organizationId,
                        projectId: props.projectId,
                        targetId: props.targetId,
                      }}
                      search={{ page: 'general' }}
                    >
                      Settings
                    </Link>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 border-b-2 border-b-transparent px-4 py-3">
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
            </div>
          )}
          {currentTarget ? (
            connect != null ? (
              connect
            ) : isCDNEnabled ? (
              <>
                <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
                  <LinkIcon size={16} className="mr-2" />
                  Connect to CDN
                </Button>
                <ConnectSchemaModal
                  organizationId={props.organizationId}
                  projectId={props.projectId}
                  targetId={props.targetId}
                  isOpen={isModalOpen}
                  toggleModalOpen={toggleModalOpen}
                />
              </>
            ) : null
          ) : null}
        </div>
      </div>
      <div className={cn('container min-h-[var(--content-height)] pb-7', className)}>
        {children}
      </div>
    </>
  );
};

const ConnectSchemaModalQuery = graphql(`
  query ConnectSchemaModal($targetSelector: TargetSelectorInput!) {
    target(selector: $targetSelector) {
      id
      project {
        id
        type
      }
      cdnUrl
      activeContracts(first: 20) {
        edges {
          node {
            id
            contractName
            cdnUrl
          }
        }
      }
    }
  }
`);

type CdnArtifactType = 'sdl' | 'services' | 'supergraph' | 'metadata';

const ArtifactToProjectTypeMapping: Record<ProjectType, CdnArtifactType[]> = {
  [ProjectType.Single]: ['sdl', 'metadata'],
  [ProjectType.Stitching]: ['sdl', 'services'],
  [ProjectType.Federation]: ['sdl', 'services', 'supergraph'],
};

const ArtifactTypeToDisplayName: Record<CdnArtifactType, string> = {
  sdl: 'GraphQL SDL',
  services: 'Services Definition and SDL',
  supergraph: 'Apollo Federation Supergraph',
  metadata: 'Hive Schema Metadata',
};

function composeEndpoint(baseUrl: string, artifactType: CdnArtifactType): string {
  return `${baseUrl}/${artifactType}`;
}

export function ConnectSchemaModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const [query] = useQuery({
    query: ConnectSchemaModalQuery,
    variables: {
      targetSelector: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
      },
    },
    requestPolicy: 'cache-and-network',
    // we only need to fetch the data when the modal is open
    pause: !props.isOpen,
  });

  const [selectedGraph, setSelectedGraph] = useState<string>('DEFAULT_GRAPH');
  const [selectedArtifact, setSelectedArtifact] = useState<CdnArtifactType>('sdl');

  const selectedContract = useMemo(() => {
    if (selectedGraph === 'DEFAULT_GRAPH') {
      return null;
    }
    return query.data?.target?.activeContracts.edges.find(
      ({ node }) => node.contractName === selectedGraph,
    )?.node;
  }, [selectedGraph]);

  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-[600px] max-w-[700px] gap-5 md:w-3/5">
        <DialogHeader>
          <DialogTitle>Hive CDN Access</DialogTitle>
          <DialogDescription>
            Hive leverages the{' '}
            <UiLink
              as="a"
              variant="primary"
              className="font-bold underline"
              href="https://www.cloudflare.com/network"
              target="_blank"
              rel="noreferrer"
            >
              CloudFlare Global Network
            </UiLink>{' '}
            to deliver your GraphQL schema and schema metadata. This means that your schema will be
            available from the nearest location to your GraphQL gateway, with 100% uptime,
            regardless of Hive's status.
          </DialogDescription>
        </DialogHeader>
        {query.data?.target && (
          <>
            <DialogDescription>
              Based on your project type, you can access different artifacts from Hive's CDN:
            </DialogDescription>
            <div className="flex flex-row justify-start gap-3">
              <Select
                value={selectedGraph}
                onValueChange={value => {
                  if (
                    value !== 'DEFAULT_GRAPH' &&
                    selectedArtifact !== 'sdl' &&
                    selectedArtifact !== 'supergraph'
                  ) {
                    setSelectedArtifact('sdl');
                  }
                  setSelectedGraph(value);
                }}
              >
                <SelectTrigger className="w-[250px] max-w-[300px]">
                  <SelectValue placeholder="Select Graph" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEFAULT_GRAPH">Default Graph</SelectItem>
                  {query.data.target.activeContracts.edges.map(({ node }) => (
                    <SelectItem key={node.id} value={node.contractName}>
                      {node.contractName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedArtifact}
                onValueChange={(value: CdnArtifactType) => setSelectedArtifact(value)}
              >
                <SelectTrigger className="w-[250px] max-w-[300px]">
                  <SelectValue placeholder="Select Artifact" />
                </SelectTrigger>
                <SelectContent>
                  {ArtifactToProjectTypeMapping[query.data.target.project.type].map(t => (
                    <SelectItem
                      key={t}
                      value={t}
                      disabled={
                        t !== 'supergraph' && t !== 'sdl' && selectedGraph !== 'DEFAULT_GRAPH'
                      }
                    >
                      {ArtifactTypeToDisplayName[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogDescription>
              To access your schema from Hive's CDN, use the following endpoint:
            </DialogDescription>
            <CopyValue
              value={composeEndpoint(
                selectedContract?.cdnUrl ?? query.data.target.cdnUrl,
                selectedArtifact,
              )}
            />
            <DialogDescription>
              To authenticate,{' '}
              <UiLink
                as="a"
                search={{
                  page: 'cdn',
                }}
                variant="primary"
                className="font-bold underline"
                to="/$organizationId/$projectId/$targetId/settings"
                params={{
                  organizationId: props.organizationId,
                  projectId: props.projectId,
                  targetId: props.targetId,
                }}
                target="_blank"
                rel="noreferrer"
              >
                create a CDN Access Token from your target's Settings page
              </UiLink>{' '}
              use the CDN access token in your HTTP headers:
              <br />
            </DialogDescription>
            <DialogDescription>
              <Tag className="relative w-full">
                X-Hive-CDN-Key: {'<'}Your Access Token{'>'}
              </Tag>
            </DialogDescription>

            <DocsLink href="/features/high-availability-cdn">
              Learn more about Hive High-Availability CDN
            </DocsLink>
            {query.data.target.project.type === ProjectType.Federation ? (
              <DialogDescription className="text-center">
                Read the{' '}
                <UiLink
                  variant="primary"
                  target="_blank"
                  rel="noreferrer"
                  to={getDocsUrl('/integrations/apollo-gateway#supergraph-sdl-from-the-cdn')}
                >
                  Using the Registry with a Apollo Gateway
                </UiLink>{' '}
                chapter in our documentation.
              </DialogDescription>
            ) : null}
          </>
        )}
        <DialogFooter>
          <Button type="button" onClick={props.toggleModalOpen}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
