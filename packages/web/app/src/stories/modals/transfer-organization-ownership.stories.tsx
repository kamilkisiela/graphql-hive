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

const formSchema = z.object({
  newOwner: z.string().min(1, 'New owner is not defined'),
  confirmation: z
    .string()
    .min(1)
    .refine(val => {
      if (val !== 'organization') {
        return false;
      }
      return true;
    }, 'Type organization name to confirm'),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        newOwner: '',
        confirmation: '',
      },
    });

    const [openModal, setOpenModal] = useState(false);
    const [openPopup, setOpenPopup] = useState(false);
    const [selected, setSelected] = useState<MemberFromFragment | undefined>();
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <TransferOrganizationOwnershipModalContent
            handleRoute={() => console.log('Route')}
            isOpen={openModal}
            onSelect={() => console.log('Select')}
            options={[
              {
                label: 'Test',
                value: 'test',
              },
              {
                label: 'Test 2',
                value: 'test2',
              },
            ]}
            onSubmit={async () => console.log('Submit')}
            toggleModalOpen={toggleModalOpen}
            openPopup={openPopup}
            organization={{
              cleanId: 'test',
            }}
            searchPhrase="test"
            selected={selected}
            setOpenPopup={setOpenPopup}
            schema={formSchema}
            key={'transfer-organization-ownership-modal'}
          />
        )}
      </>
    );
  },
};
