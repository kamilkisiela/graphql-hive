import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Meta, StoryObj } from '@storybook/react';
import { DeleteOrganizationModalContent } from '@/pages/organization-settings';

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