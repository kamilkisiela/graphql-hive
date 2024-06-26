import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteProjectModalContent } from '@/components/ui/modal/delete-project';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DeleteProjectModalContent> = {
  title: 'Modals/Delete Project Modal',
  component: DeleteProjectModalContent,
};

export default meta;
type Story = StoryObj<typeof DeleteProjectModalContent>;

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <DeleteProjectModalContent
            handleDelete={() => console.log('Delete')}
            isOpen={openModal}
            toggleModalOpen={toggleModalOpen}
            key="delete-project-modal"
          />
        )}
      </>
    );
  },
};
