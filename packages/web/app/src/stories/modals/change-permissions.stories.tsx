import { useState } from 'react';
import { usePermissionsManager } from '@/components/organization/Permissions';
import { Button } from '@/components/ui/button';
import { ChangePermissionsModalContent } from '@/components/ui/modal/change-permissions';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof ChangePermissionsModalContent> = {
  title: 'Modals/Change Permissions Modal',
  component: ChangePermissionsModalContent,
};

export default meta;
type Story = StoryObj<typeof ChangePermissionsModalContent>;

export const Default: Story = {
  render: () => {
    const initialScopes = {
      organization: [],
      project: [],
      target: [],
    };

    const manager = {
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [],
      canAccessOrganization: () => true,
      canAccessProject: () => true,
      canAccessTarget: () => true,
      noneSelected: true,
      setOrganizationScopes: () => console.log('Set Organization Scopes'),
      setProjectScopes: () => console.log('Set Project Scopes'),
      setTargetScopes: () => console.log('Set Target Scopes'),
      state: 'IDLE',
      submit: () => console.log('Submit'),
    } as ReturnType<typeof usePermissionsManager>;

    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <ChangePermissionsModalContent
            manager={manager}
            isOpen={openModal}
            toggleModalOpen={toggleModalOpen}
            initialScopes={initialScopes}
            onSubmit={() => console.log('Submit')}
            key="change-permissions-modal"
          />
        )}
      </>
    );
  },
};
