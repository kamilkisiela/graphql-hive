import { ReactElement, useState } from 'react';
import { useQuery } from 'urql';
import {
  Button,
  CopyValue,
  DocsLink,
  Heading,
  Link,
  Modal,
  RadixSelect,
  Tag,
} from '@/components/v2';
import { graphql } from '@/gql';
import { ProjectType } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useRouteSelector } from '@/lib/hooks';

const ConnectSchemaModalQuery = graphql(`
  query ConnectSchemaModal($targetSelector: TargetSelectorInput!) {
    target(selector: $targetSelector) {
      id
      project {
        id
        type
      }
      cdnUrl
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

export const ConnectSchemaModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const [selectedArtifact, setSelectedArtifact] = useState<CdnArtifactType>('sdl');
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ConnectSchemaModalQuery,
    variables: {
      targetSelector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
    },
    requestPolicy: 'cache-and-network',
    // we only need to fetch the data when the modal is open
    pause: !isOpen,
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="flex w-[800px] flex-col gap-5">
      <Heading className="text-center">Hive CDN Access</Heading>

      {query.data?.target && (
        <>
          <p className="text-sm text-gray-500">
            Hive leverages the{' '}
            <Link
              variant="primary"
              className="font-bold underline"
              href="https://www.cloudflare.com/network"
              target="_blank"
              rel="noreferrer"
            >
              CloudFlare Global Network
            </Link>{' '}
            to deliver your GraphQL schema and schema metadata. This means that your schema will be
            available from the nearest location to your GraphQL gateway, with 100% uptime,
            regardless of Hive's status.
          </p>
          <p className="text-sm text-gray-500">
            Based on your project type, you can access different artifacts from Hive's CDN:
          </p>
          <div>
            <RadixSelect
              placeholder="Select Artifact"
              name="artifact-select"
              position="popper"
              value={selectedArtifact}
              options={ArtifactToProjectTypeMapping[query.data.target.project.type].map(t => ({
                value: t,
                label: ArtifactTypeToDisplayName[t],
              }))}
              onChange={setSelectedArtifact}
            />
          </div>
          <span className="text-sm text-gray-500">
            To access your schema from Hive's CDN, use the following endpoint:
          </span>
          <CopyValue value={composeEndpoint(query.data.target.cdnUrl, selectedArtifact)} />
          <span className="text-sm text-gray-500">
            To authenticate,{' '}
            <Link
              variant="primary"
              className="font-bold underline"
              href={{
                pathname: '/[organizationId]/[projectId]/[targetId]/settings#cdn-access-tokens',
                query: {
                  organizationId: router.organizationId,
                  projectId: router.projectId,
                  targetId: router.targetId,
                },
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
            <Tag>
              X-Hive-CDN-Key: {'<'}Your Access Token{'>'}
            </Tag>
          </p>
          <DocsLink href="/features/high-availability-cdn">
            Learn more about Hive High-Availability CDN
          </DocsLink>
          {query.data.target.project.type === ProjectType.Federation ? (
            <p className="text-sm text-gray-500">
              Read the{' '}
              <Link
                variant="primary"
                target="_blank"
                rel="noreferrer"
                href={getDocsUrl('/integrations/apollo-gateway#supergraph-sdl-from-the-cdn') ?? ''}
              >
                Using the Registry with a Apollo Gateway
              </Link>{' '}
              chapter in our documentation.
            </p>
          ) : null}
        </>
      )}
      <Button
        type="button"
        variant="secondary"
        size="large"
        onClick={toggleModalOpen}
        className="self-end"
      >
        Close
      </Button>
    </Modal>
  );
};
