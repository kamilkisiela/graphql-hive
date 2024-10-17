import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LeaveOrganizationModalContent } from '@/components/ui/user-menu';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof LeaveOrganizationModalContent> = {
  title: 'Modals/LeaveOrganizationModalContent',
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
            isOpen={openModal}
            onSubmit={() => console.log('submit')}
            organizationSlug="test-organization"
            toggleModalOpen={toggleModalOpen}
          />
        )}
      </>
    );
  },
};
