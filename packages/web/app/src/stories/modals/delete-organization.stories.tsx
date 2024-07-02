import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteOrganizationModalContent } from '@/components/ui/modal/delete-organization';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DeleteOrganizationModalContent> = {
  title: 'Modals/Delete Organization Modal',
  component: DeleteOrganizationModalContent,
};

export default meta;
type Story = StoryObj<typeof DeleteOrganizationModalContent>;

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <DeleteOrganizationModalContent
            isOpen={openModal}
            toggleModalOpen={toggleModalOpen}
            handleDelete={() => console.log('Delete')}
            key="delete-organization-modal"
          />
        )}
      </>
    );
  },
};
