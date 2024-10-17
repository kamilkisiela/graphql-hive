import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CreateTargetModalContent } from '@/components/layouts/project';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateTargetModalContent> = {
  title: 'Modals/Create Target Modal',
  component: CreateTargetModalContent,
};

export default meta;
type Story = StoryObj<typeof CreateTargetModalContent>;

const formSchema = z.object({
  targetSlug: z
    .string({
      required_error: 'Target slug is required',
    })
    .min(2, {
      message: 'Target slug must be at least 2 characters long',
    })
    .max(50, {
      message: 'Target slug must be at most 50 characters long',
    }),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        targetSlug: '',
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
