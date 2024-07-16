import { useState } from 'react';
import { UseQueryState } from 'urql';
import { ConnectSchemaModalContent } from '@/components/layouts/target';
import { Button } from '@/components/ui/button';
import { ProjectType, type ConnectSchemaModalQuery as ConnectSchemaModalType } from '@/gql/graphql';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof ConnectSchemaModalContent> = {
  title: 'Modals/ Connect Schema Modal',
  component: ConnectSchemaModalContent,
};

export default meta;
type Story = StoryObj<typeof ConnectSchemaModalContent>;

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);
    const mockOrganizationId = 'mockOrganizationId';
    const mockProjectId = 'mockProjectId';
    const mockTargetId = 'mockTargetId';
    const mockQuery: UseQueryState<
      ConnectSchemaModalType,
      {
        targetSelector: {
          organization: string;
          project: string;
          target: string;
        };
      }
    > = {
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
                  cdnUrl: 'https://cdn-url',
                  contractName: 'mockContractName',
                  id: 'mockContractId',
                },
              },
            ],
          },
          cdnUrl: 'https://cdn-url',
          id: 'mockTargetId',
          project: {
            __typename: 'Project',
            id: 'mockProjectId',
            type: ProjectType.Single,
          },
        },
      },
      error: undefined,
      extensions: undefined,
      operation: undefined,
    };

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <ConnectSchemaModalContent
            isOpen={openModal}
            organizationId={mockOrganizationId}
            projectId={mockProjectId}
            targetId={mockTargetId}
            query={mockQuery}
            toggleModalOpen={toggleModalOpen}
            key="connect-schema-modal-content"
          />
        )}
      </>
    );
  },
};
