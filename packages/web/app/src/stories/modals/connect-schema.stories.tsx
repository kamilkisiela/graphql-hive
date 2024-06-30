import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyValue } from '@/components/ui/copy-value';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Heading } from '@/components/ui/heading';
import { Link } from '@/components/ui/link';
import {
  ArtifactToProjectTypeMapping,
  ArtifactTypeToDisplayName,
  ConnectSchemaModalContent,
} from '@/components/ui/modal/connect-schema';
import { Tag } from '@/components/ui/tag';
import { ProjectType } from '@/gql/graphql';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@radix-ui/react-select';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof ConnectSchemaModalContent> = {
  title: 'Modals/Connect Schema Modal',
  component: ConnectSchemaModalContent,
};

export default meta;
type Story = StoryObj<typeof ConnectSchemaModalContent>;
type CdnArtifactType = 'sdl' | 'services' | 'supergraph' | 'metadata';

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);
    const [selectedArtifact, setSelectedArtifact] = useState<CdnArtifactType>('sdl');
    const [selectedGraph, setSelectedGraph] = useState('DEFAULT_GRAPH');

    const mockQuery = {
      data: {
        target: {
          id: '1',
          project: {
            id: '1',
            type: ProjectType.Single,
          },
          cdnUrl: 'https://cdn.hive.io',
          activeContracts: {
            edges: [
              {
                node: {
                  id: '1',
                  contractName: 'contract1',
                  cdnUrl: 'https://cdn.hive.io/contract1',
                },
              },
            ],
          },
        },
      },
    };

    return (
      <>
        <Dialog open={openModal} onOpenChange={toggleModalOpen}>
          <DialogContent className="flex w-[800px] flex-col gap-5">
            <DialogHeader>
              <DialogTitle>
                <Heading className="text-center">Hive CDN Access</Heading>
              </DialogTitle>
            </DialogHeader>
            {mockQuery.data?.target && (
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
                  to deliver your GraphQL schema and schema metadata. This means that your schema
                  will be available from the nearest location to your GraphQL gateway, with 100%
                  uptime, regardless of Hive's status.
                </p>
                <p className="text-sm text-gray-500">
                  Based on your project type, you can access different artifacts from Hive's CDN:
                </p>
                <div className="flex flex-row justify-between">
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
                    <SelectTrigger className="mr-2 w-[280px]">
                      <SelectValue placeholder="Select Graph" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectLabel>Graphs</SelectLabel>
                        {[
                          { value: 'DEFAULT_GRAPH', label: 'Default Graph' },
                          ...mockQuery.data.target.activeContracts.edges.map(({ node }) => ({
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
                        {ArtifactToProjectTypeMapping[mockQuery.data.target.project.type].map(t => (
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
                <CopyValue value={'test'} />
                <span className="text-sm text-gray-500">
                  To authenticate,{' '}
                  <Link
                    search={{
                      page: 'cdn',
                    }}
                    className="font-bold text-orange-500 underline"
                    to="/$organizationId/$projectId/$targetId/settings"
                    params={{
                      organizationId: '1',
                      projectId: '1',
                      targetId: '1',
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
                {mockQuery.data.target.project.type === ProjectType.Federation ? (
                  <p className="text-sm text-gray-500">
                    Read the{' '}
                    <Link className="text-orange-500" target="_blank" rel="noreferrer">
                      Using the Registry with a Apollo Gateway
                    </Link>{' '}
                    chapter in our documentation.
                  </p>
                ) : null}
              </>
            )}
            <DialogFooter>
              <Button className="w-full" type="submit" onClick={toggleModalOpen} variant="default">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};
