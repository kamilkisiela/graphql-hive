import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteTargetModalContent } from '@/components/ui/modal/delete-target';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DeleteTargetModalContent> = {
  title: 'Modals/Delete Target Modal',
  component: DeleteTargetModalContent,
};

export default meta;
type Story = StoryObj<typeof DeleteTargetModalContent>;

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <DeleteTargetModalContent
            isOpen={openModal}
            toggleModalOpen={toggleModalOpen}
            key="delete-target-modal"
            handleDelete={() => console.log('Delete')}
          />
        )}
      </>
    );
  },
};
