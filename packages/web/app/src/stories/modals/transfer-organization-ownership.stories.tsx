import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  MemberFromFragment,
  TransferOrganizationOwnershipModalContent,
} from '@/components/ui/modal/transfer-organization-ownership';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof TransferOrganizationOwnershipModalContent> = {
  title: 'Modals/Transfer Organization Ownership Modal',
  component: TransferOrganizationOwnershipModalContent,
};

export default meta;
type Story = StoryObj<typeof TransferOrganizationOwnershipModalContent>;


type Option = {
  value: string;
  label: string;
};

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const [openPopover, setOpenPopover] = useState(false);
    const [valuePopover, setValuePopover] = useState<Option | null | undefined>(null);
    const toggleModalOpen = () => setOpenModal(!openModal);
    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <TransferOrganizationOwnershipModalContent
            handleRoute={() => console.log('handleRoute')}
            isOpen={openModal}
            openPopover={openPopover}
            options={[]}
            organization={{
              cleanId: 'cleanId',
            }}
            organizationName='Organization Name'
            setOpenPopover={setOpenPopover}
            setValuePopover={setValuePopover}
            toggleModalOpen={toggleModalOpen}
            key={"key"}
            valuePopover={valuePopover}
          />
        )}
      </>
    );
  },
};
