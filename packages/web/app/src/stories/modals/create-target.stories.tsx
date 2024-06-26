import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CreateTargetModalContent } from '@/components/ui/modal/create-target';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateTargetModalContent> = {
  title: 'Modals/Create Target Modal',
  component: CreateTargetModalContent,
};

export default meta;
type Story = StoryObj<typeof CreateTargetModalContent>;

const formSchema = z.object({
  name: z.string().min(1, {
    message: 'Target name is required',
  }),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: '',
      },
    });
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <CreateTargetModalContent
            isOpen={openModal}
            form={form}
            onSubmit={() => console.log('Submit')}
            toggleModalOpen={toggleModalOpen}
            key="create-target-modal"
          />
        )}
      </>
    );
  },
};
