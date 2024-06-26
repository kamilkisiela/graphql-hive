import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LeaveOrganizationModalContent } from '@/components/ui/modal/leave-organization';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof LeaveOrganizationModalContent> = {
  title: 'Modals/Leave Organization Modal',
  component: LeaveOrganizationModalContent,
};

export default meta;
type Story = StoryObj<typeof LeaveOrganizationModalContent>;

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);

    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <LeaveOrganizationModalContent
            organizationName="Test Organization"
            isOpen={openModal}
            onSubmit={() => console.log('Submit')}
            toggleModalOpen={toggleModalOpen}
            key="create-target-modal"
          />
        )}
      </>
    );
  },
};
