import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { LinkIcon } from 'lucide-react';
import { useQuery } from 'urql';
import { SecondaryNavigation } from '@/components/navigation/secondary-navigation';
import { InputCopy } from '@/components/ui/input-copy';
import { Link as UiLink } from '@/components/ui/link';
import { NotFound, resourceAccessDescription } from '@/components/ui/not-found/not-found';
import { Button } from '@/components/ui/primitives/button/button';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { Label } from '@/components/ui/primitives/label/label';
import { Dialog } from '@/components/ui/primitives/overlays/dialog/dialog';
import { graphql } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useSlugs, useToggle, useViewer } from '@/lib/hooks';
import {
  carriedRange,
  retentionBoundary,
  startsWithin,
} from '@/lib/hooks/use-date-range-controller';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { useLocation } from '@tanstack/react-router';
import { Tabs } from '../ui/primitives/tabs/tabs';
import { TargetLayoutQuery } from './queries';
import * as styles from './target.css';

export const TargetLayout = ({ children }: { children: ReactNode }): ReactElement | null => {
  const params = useSlugs('target');
  // The period pages share the range the URL holds; a page without one carries nothing.
  const range = carriedRange(useLocation().search);

  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: TargetLayoutQuery,
    requestPolicy: 'cache-first',
    variables: params,
  });

  const viewer = useViewer();
  const currentOrganization = query.data?.organization;
  // Usage pages reset a range the retention does not cover; carrying one there would only earn a toast.
  const retention = currentOrganization?.usageRetentionInDays;
  const usageRange =
    range.from !== undefined &&
    retention !== undefined &&
    !startsWithin({ from: range.from }, retentionBoundary(retention))
      ? {}
      : range;
  const currentProject = query.data?.organization?.project;
  const currentTarget = query.data?.organization?.project?.target;

  const isCDNEnabled = viewer.data?.isCDNEnabled === true;

  useLastVisitedOrganizationWriter(currentOrganization?.slug);

  return (
    <>
      {query.fetching === false &&
      query.stale === false &&
      (currentProject === null || currentOrganization === null || currentTarget === null) ? (
        <NotFound
          variants={{ layout: 'horizontal', illustration: 'connection' }}
          title="404 - This target does not seem to exist."
          description={resourceAccessDescription}
        />
      ) : (
        <>
          <SecondaryNavigation
            loading={!currentOrganization || !currentProject || !currentTarget}
            links={
              currentOrganization && currentProject && currentTarget
                ? [
                    {
                      label: 'Schema',
                      to: '/$organizationSlug/$projectSlug/$targetSlug',
                      params,
                      exact: true,
                    },
                    {
                      label: 'Checks',
                      to: '/$organizationSlug/$projectSlug/$targetSlug/checks',
                      params,
                    },
                    {
                      label: 'Explorer',
                      to: '/$organizationSlug/$projectSlug/$targetSlug/explorer',
                      params,
                      search: usageRange,
                    },
                    {
                      label: 'History',
                      to: '/$organizationSlug/$projectSlug/$targetSlug/history',
                      params,
                    },
                    {
                      label: 'Insights',
                      to: '/$organizationSlug/$projectSlug/$targetSlug/insights',
                      params,
                      search: usageRange,
                    },
                    {
                      label: 'Traces',
                      visible: currentTarget.viewerCanAccessTraces,
                      to: '/$organizationSlug/$projectSlug/$targetSlug/traces',
                      params,
                      search: range,
                    },
                    {
                      label: 'Apps',
                      visible: currentTarget.viewerCanViewAppDeployments,
                      to: '/$organizationSlug/$projectSlug/$targetSlug/apps',
                      params,
                    },
                    {
                      label: 'Laboratory',
                      visible: currentTarget.viewerCanViewLaboratory,
                      to: '/$organizationSlug/$projectSlug/$targetSlug/laboratory',
                      params,
                    },
                    {
                      label: 'Proposals',
                      visible: currentTarget.viewerCanViewSchemaProposals,
                      to: '/$organizationSlug/$projectSlug/$targetSlug/proposals',
                      params,
                    },
                    // Alert activity has its own default and a shorter retention; a usage range would mostly reset.
                    {
                      label: 'Alerts',
                      visible: currentTarget.viewerCanUseMetricAlertRules,
                      to: '/$organizationSlug/$projectSlug/$targetSlug/alerts',
                      params,
                    },
                    {
                      label: 'Settings',
                      visible: currentTarget.viewerCanAccessSettings,
                      to: '/$organizationSlug/$projectSlug/$targetSlug/settings',
                      params,
                    },
                  ]
                : []
            }
            actions={
              currentTarget && isCDNEnabled ? (
                <>
                  <div className={styles.targetLayoutDiv}>
                    <Button onClick={toggleModalOpen} variant="link">
                      <span className={styles.targetLayoutSpan}>
                        <LinkIcon size={16} className={styles.targetLayoutLinkIcon} />
                        Connect to CDN
                      </span>
                    </Button>
                  </div>
                  <ConnectSchemaModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
                </>
              ) : null
            }
          />
          {children}
        </>
      )}
    </>
  );
};

const ConnectSchemaModalQuery = graphql(`
  query ConnectSchemaModal($targetSelector: TargetSelectorInput!) {
    target(reference: { bySelector: $targetSelector }) {
      id
      project {
        id
        type
      }
      cdnUrl
      contracts(first: 20) {
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
  [ProjectType.Federation]: ['supergraph', 'sdl', 'services'],
  [ProjectType.Single]: ['sdl', 'metadata'],
  [ProjectType.Stitching]: ['sdl', 'services'],
};

const ArtifactTypeToDisplayName: Record<CdnArtifactType, string> = {
  supergraph: 'Supergraph',
  sdl: 'Public GraphQL SDL',
  services: 'Services Definition and SDL',
  metadata: 'Hive Schema Metadata',
};

function composeEndpoint(baseUrl: string, artifactType: CdnArtifactType): string {
  return `${baseUrl}/${artifactType}`;
}

export function ConnectSchemaModal(props: { isOpen: boolean; toggleModalOpen: () => void }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [query] = useQuery({
    query: ConnectSchemaModalQuery,
    variables: {
      targetSelector: {
        organizationSlug,
        projectSlug,
        targetSlug,
      },
    },
    requestPolicy: 'cache-and-network',
    // we only need to fetch the data when the modal is open
    pause: !props.isOpen,
  });

  const [selectedGraph, setSelectedGraph] = useState<string>('DEFAULT_GRAPH');

  const selectedContract = useMemo(() => {
    if (selectedGraph === 'DEFAULT_GRAPH') {
      return null;
    }
    return query.data?.target?.contracts.edges.find(
      ({ node }) => node.contractName === selectedGraph,
    )?.node;
  }, [selectedGraph]);

  const target = query.data?.target;

  const [selectedArtifact, setSelectedArtifact] = useResetState<CdnArtifactType>(
    () => (target?.project.type === ProjectType.Federation ? 'supergraph' : 'sdl'),
    [target?.project.type],
  );

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={props.toggleModalOpen}
      width="lg"
      title="Hive CDN Access"
      description={
        <>
          Learn more in our{' '}
          <UiLink
            variant="primary"
            href={getDocsUrl('/high-availability-cdn')}
            target="_blank"
            rel="noreferrer"
          >
            High-Availability CDN
          </UiLink>{' '}
          documentation.
        </>
      }
    >
      <div className={styles.connectSchemaModalDiv}>
        {target && (
          <>
            <div className={styles.connectSchemaModalDiv2}>
              <div>
                <Label htmlFor="cdn-graph" label="Graph Variant" />
                <Select
                  id="cdn-graph"
                  options={[
                    { value: 'DEFAULT_GRAPH', label: 'Default Graph' },
                    ...target.contracts.edges.map(({ node }) => ({
                      value: node.contractName,
                      label: node.contractName,
                    })),
                  ]}
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
                  placeholder="Select Graph"
                  width="lg"
                  onSurface="raised"
                />
              </div>
              <div>
                <Label htmlFor="cdn-artifact" label="Artifact" />
                <Select
                  id="cdn-artifact"
                  options={ArtifactToProjectTypeMapping[target.project.type].map(t => ({
                    value: t,
                    label: ArtifactTypeToDisplayName[t],
                    disabled:
                      t !== 'supergraph' && t !== 'sdl' && selectedGraph !== 'DEFAULT_GRAPH',
                  }))}
                  value={selectedArtifact}
                  onValueChange={value => setSelectedArtifact(value as CdnArtifactType)}
                  placeholder="Select Artifact"
                  width="lg"
                  onSurface="raised"
                />
              </div>
            </div>
            {selectedArtifact === 'supergraph' ? (
              <FederationModalContent cdnUrl={selectedContract?.cdnUrl ?? target.cdnUrl} />
            ) : (
              <div className={styles.connectSchemaModalDiv3}>
                <p>To access your schema from Hive's CDN, use the following endpoint:</p>
                <InputCopy
                  onSurface="raised"
                  value={composeEndpoint(
                    selectedContract?.cdnUrl ?? target.cdnUrl,
                    selectedArtifact,
                  )}
                />
                <p>
                  To authenticate,{' '}
                  <UiLink
                    variant="primary"
                    to="/$organizationSlug/$projectSlug/$targetSlug/settings/cdn"
                    params={{
                      organizationSlug,
                      projectSlug,
                      targetSlug,
                    }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    create a CDN Access Token from your target's Settings page
                  </UiLink>{' '}
                  use the CDN access token in your HTTP headers:
                  <br />
                </p>
                <InputCopy onSurface="raised" value="X-Hive-CDN-Key: <Your Access Token>" />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

function FederationModalContent(props: { cdnUrl: string }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  // reference local machine and not the docker container
  const dockerCdnUrl = props.cdnUrl.replace('http://localhost:', 'http://host.docker.internal:');
  const authenticateSection = (
    <p>
      Replace "{'<hive_cdn_access_key>'}" with a{' '}
      <UiLink
        variant="primary"
        to="/$organizationSlug/$projectSlug/$targetSlug/settings/cdn"
        params={{
          organizationSlug,
          projectSlug,
          targetSlug,
        }}
        target="_blank"
        rel="noreferrer"
      >
        CDN Access Token from your target's settings
      </UiLink>
      .
    </p>
  );
  return (
    <div className={styles.federationModalContentDiv}>
      <Tabs
        defaultValue="hive-gateway"
        items={[
          {
            value: 'hive-gateway',
            label: 'Hive Gateway',
            content: (
              <div className={styles.federationModalContentDiv2}>
                <p>
                  Start up a Hive Gateway instance polling the supergraph from the Hive CDN using
                  the following command.
                </p>
                {authenticateSection}
                <div className={styles.federationModalContentDiv3}>
                  <InputCopy
                    onSurface="raised"
                    multiline
                    value={`docker run --name hive-gateway --rm -p 4000:4000 \\
  ghcr.io/graphql-hive/gateway supergraph \\
  "${dockerCdnUrl}" \\
  --hive-cdn-key '<hive_cdn_access_key>'`}
                  />
                </div>
                <p>
                  For more information please refer to our{' '}
                  <UiLink
                    variant="primary"
                    target="_blank"
                    rel="noreferrer"
                    to={getDocsUrl('/gateway/usage-reporting')}
                  >
                    Hive Gateway documentation
                  </UiLink>
                  .
                </p>
              </div>
            ),
          },
          {
            value: 'hive-router',
            label: 'Hive Router',
            content: (
              <div className={styles.federationModalContentDiv4}>
                <p>
                  Start up a Hive Router instance polling the supergraph from the Hive CDN using the
                  following command.
                </p>
                {authenticateSection}
                <InputCopy
                  onSurface="raised"
                  multiline
                  value={`docker run --name hive-router --rm -p 4000:4000 \\
  --env HIVE_CDN_ENDPOINT="${dockerCdnUrl}" \\
  --env HIVE_CDN_KEY="<hive_cdn_access_key>" \\
  ghcr.io/graphql-hive/router`}
                />
                <p>
                  For more information please refer to our{' '}
                  <UiLink
                    variant="primary"
                    target="_blank"
                    rel="noreferrer"
                    to={getDocsUrl('/router/observability/usage_reporting')}
                  >
                    Hive Router documentation
                  </UiLink>
                  .
                </p>
              </div>
            ),
          },
          {
            value: 'apollo-router',
            label: 'Apollo Router',
            content: (
              <div className={styles.federationModalContentDiv5}>
                <p>
                  Start up a Apollo Router instance polling the supergraph from the Hive CDN using
                  the following command.
                </p>
                {authenticateSection}
                <InputCopy
                  onSurface="raised"
                  multiline
                  value={`docker run --name apollo-router -p 4000:4000 --rm \\
  --env HIVE_CDN_ENDPOINT="${dockerCdnUrl}" \\
  --env HIVE_CDN_KEY="<hive_cdn_access_key>"
  ghcr.io/graphql-hive/apollo-router`}
                />
                <p>
                  For more information please refer to our{' '}
                  <UiLink
                    variant="primary"
                    target="_blank"
                    rel="noreferrer"
                    to={getDocsUrl('/other-integrations/apollo-router')}
                  >
                    Apollo Router documentation
                  </UiLink>
                  .
                </p>
              </div>
            ),
          },
          {
            value: 'grafbase-gateway',
            label: 'Grafbase Gateway',
            content: (
              <div className={styles.federationModalContentDiv6}>
                <p>
                  Start up a Grafbase Gateway instance polling the supergraph from the Hive CDN
                  using the following command.
                </p>
                {authenticateSection}
                <InputCopy
                  onSurface="raised"
                  multiline
                  value={`docker run --name grafbase-gateway -p 5000:5000 --rm \\
  --env HIVE_CDN_ENDPOINT="${dockerCdnUrl}" \\
  --env HIVE_CDN_KEY="<hive_cdn_access_key>"
  ghcr.io/grafbase/gateway`}
                />
                <p>
                  For more information please refer to our{' '}
                  <UiLink
                    variant="primary"
                    target="_blank"
                    rel="noreferrer"
                    to={getDocsUrl('/other-integrations/grafbase-gateway')}
                  >
                    Grafbase Gateway documentation
                  </UiLink>
                  .
                </p>
              </div>
            ),
          },
          {
            value: 'cdn',
            label: 'Custom / HTTP',
            content: (
              <div className={styles.federationModalContentDiv7}>
                <p>
                  For other tooling you can access the raw supergraph by sending a HTTP request.
                </p>
                <p>To access your schema from Hive's CDN, use the following endpoint:</p>
                <div>
                  <InputCopy onSurface="raised" multiline value={`${props.cdnUrl}/supergraph`} />
                </div>
                <p>Here is an example calling the endpoint using curl.</p>
                {authenticateSection}
                <div className={styles.federationModalContentDiv8}>
                  <InputCopy
                    onSurface="raised"
                    multiline
                    value={`curl -H 'X-Hive-CDN-Key: <hive_cdn_access_key>' \\
  ${props.cdnUrl}/supergraph`}
                  />
                </div>
                <p>
                  For more information please refer to our{' '}
                  <UiLink
                    variant="primary"
                    target="_blank"
                    rel="noreferrer"
                    to={getDocsUrl('/high-availability-cdn')}
                  >
                    CDN documentation
                  </UiLink>
                  .
                </p>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
