import { useState } from 'react';
import { UseQueryState } from 'urql';
import { Button } from '@/components/ui/button';
import { ConnectSchemaModalContent } from '@/components/ui/modal/connect-schema';
import { ProjectType, type ConnectSchemaModalQuery as ConnectSchemaQuery } from '@/gql/graphql';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof ConnectSchemaModalContent> = {
  title: 'Modals/Connect Schema Modal',
  component: ConnectSchemaModalContent,
};

export default meta;
type Story = StoryObj<typeof ConnectSchemaModalContent>;

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);
    const [selectedGraph, setSelectedGraph] = useState('DEFAULT_GRAPH');

    const mockQuery = {
      fetching: false,
      stale: false,
      data: {
        __typename: 'Query',
        target: {
          __typename: 'Target',
          activeContracts: {
            __typename: 'ContractConnection',
            edges: [
              {
                __typename: 'ContractEdge',
                node: {
                  __typename: 'Contract',
                  contractName: 'DEFAULT_GRAPH',
                  cdnUrl: 'https://cdn.example.com',
                  id: '1',
                },
              },
            ],
          },
          cdnUrl: 'https://cdn.example.com',
          id: '1',
          project: {
            __typename: 'Project',
            id: '1',
            type: ProjectType.Single,
          },
        },
      },
    } as UseQueryState<ConnectSchemaQuery>;

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <ConnectSchemaModalContent
            isOpen={openModal}
            organizationId="1"
            projectId="1"
            query={mockQuery}
            selectedGraph={selectedGraph}
            setSelectedGraph={setSelectedGraph}
            targetId="1"
            toggleModalOpen={toggleModalOpen}
            key="1"
          />
        )}
      </>
    );
  },
};
