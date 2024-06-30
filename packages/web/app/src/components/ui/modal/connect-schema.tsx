import { ReactElement, useMemo, useState } from 'react';
import { useQuery, UseQueryState } from 'urql';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Heading } from '@/components/ui/heading';
import { graphql } from '@/gql';
import { ProjectType, type ConnectSchemaModalQuery as ConnectSchemaQuery } from '@/gql/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Link } from '@tanstack/react-router';
import { CopyValue } from '../copy-value';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../select';
import { Tag } from '../tag';

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

export const ArtifactToProjectTypeMapping: Record<ProjectType, CdnArtifactType[]> = {
  [ProjectType.Single]: ['sdl', 'metadata'],
  [ProjectType.Stitching]: ['sdl', 'services'],
  [ProjectType.Federation]: ['sdl', 'services', 'supergraph'],
};

export const ArtifactTypeToDisplayName: Record<CdnArtifactType, string> = {
  sdl: 'GraphQL SDL',
  services: 'Services Definition and SDL',
  supergraph: 'Apollo Federation Supergraph',
  metadata: 'Hive Schema Metadata',
};

function composeEndpoint(baseUrl: string, artifactType: CdnArtifactType): string {
  return `${baseUrl}/${artifactType}`;
}

export const ConnectSchemaModal = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const { isOpen, toggleModalOpen } = props;
  const [selectedGraph, setSelectedGraph] = useState<string>('DEFAULT_GRAPH');
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
    pause: !isOpen,
  });

  const selectedContract = useMemo(() => {
    if (selectedGraph === 'DEFAULT_GRAPH') {
      return null;
    }
    return query.data?.target?.activeContracts.edges.find(
      ({ node }) => node.contractName === selectedGraph,
    )?.node;
  }, [selectedGraph, query.data?.target?.activeContracts.edges]);

  return (
    <ConnectSchemaModalContent
      isOpen={isOpen}
      toggleModalOpen={toggleModalOpen}
      query={query}
      selectedGraph={selectedGraph}
      setSelectedGraph={setSelectedGraph}
      selectedContract={selectedContract}
      organizationId={props.organizationId}
      projectId={props.projectId}
      targetId={props.targetId}
    />
  );
};

export const ConnectSchemaModalContent = (props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  query: UseQueryState<ConnectSchemaQuery>;
  selectedGraph: string;
  setSelectedGraph: (value: string) => void;
  selectedContract:
    | {
        __typename: 'Contract';
        id: string;
        contractName: string;
        cdnUrl: string;
      }
    | null
    | undefined;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement => {
  const [selectedArtifact, setSelectedArtifact] = useState<CdnArtifactType>('sdl');
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="flex w-[800px] flex-col gap-5">
        <DialogHeader>
          <DialogTitle>
            <Heading className="text-center">Hive CDN Access</Heading>
          </DialogTitle>
        </DialogHeader>
        {props.query.data?.target && (
          <>
            <p className="text-sm text-gray-500">
              Hive leverages the{' '}
              <Link
                as="a"
                className="font-bold text-orange-500 underline"
                href="https://www.cloudflare.com/network"
                target="_blank"
                rel="noreferrer"
              >
                CloudFlare Global Network
              </Link>{' '}
              to deliver your GraphQL schema and schema metadata. This means that your schema will
              be available from the nearest location to your GraphQL gateway, with 100% uptime,
              regardless of Hive's status.
            </p>
            <p className="text-sm text-gray-500">
              Based on your project type, you can access different artifacts from Hive's CDN:
            </p>
            <div className="flex flex-row justify-between">
              <Select
                value={props.selectedGraph}
                onValueChange={value => {
                  if (
                    value !== 'DEFAULT_GRAPH' &&
                    selectedArtifact !== 'sdl' &&
                    selectedArtifact !== 'supergraph'
                  ) {
                    setSelectedArtifact('sdl');
                  }
                  props.setSelectedGraph(value);
                }}
              >
                <SelectTrigger className="mr-2 w-[280px]">
                  <SelectValue placeholder="Select Graph" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectLabel>Graphs</SelectLabel>
                    {[
                      { value: 'DEFAULT_GRAPH', label: 'Default Graph' },
                      ...props.query.data.target.activeContracts.edges.map(({ node }) => ({
                        value: node.contractName,
                        label: node.contractName,
                      })),
                    ].map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={selectedArtifact}
                onValueChange={value => setSelectedArtifact(value as CdnArtifactType)}
              >
                <SelectTrigger className="mr-2 w-[280px]">
                  <SelectValue placeholder="Select Artifact" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectLabel>Artifacts</SelectLabel>
                    {ArtifactToProjectTypeMapping[props.query.data.target.project.type].map(t => (
                      <SelectItem key={t} value={t}>
                        {ArtifactTypeToDisplayName[t]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-gray-500">
              To access your schema from Hive's CDN, use the following endpoint:
            </span>
            <CopyValue
              value={composeEndpoint(
                props.selectedContract?.cdnUrl ?? props.query.data.target.cdnUrl,
                selectedArtifact,
              )}
            />
            <span className="text-sm text-gray-500">
              To authenticate,{' '}
              <Link
                search={{
                  page: 'cdn',
                }}
                className="font-bold text-orange-500 underline"
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
              </Link>{' '}
              use the CDN access token in your HTTP headers:
              <br />
            </span>
            <p className="text-sm text-gray-500">
              <Tag className="w-full">
                X-Hive-CDN-Key: {'<'}Your Access Token{'>'}
              </Tag>
            </p>
            <Button asChild variant="link" className="whitespace-pre-wrap p-0 text-orange-500">
              <a href={'/features/high-availability-cdn'} target="_blank" rel="noreferrer">
                Learn more about Hive High-Availability CDN
                <ExternalLinkIcon className="inline pl-1" />
              </a>
            </Button>
            {props.query.data.target.project.type === ProjectType.Federation ? (
              <p className="text-sm text-gray-500">
                Read the{' '}
                <Link
                  className="text-orange-500"
                  target="_blank"
                  rel="noreferrer"
                  to={getDocsUrl('/integrations/apollo-gateway#supergraph-sdl-from-the-cdn')}
                >
                  Using the Registry with a Apollo Gateway
                </Link>{' '}
                chapter in our documentation.
              </p>
            ) : null}
          </>
        )}
        <DialogFooter>
          <Button
            className="w-full"
            type="submit"
            onClick={props.toggleModalOpen}
            variant="default"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
