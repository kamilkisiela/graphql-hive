import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CreateTargetModalContent } from '@/components/ui/create-target';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateTargetModalContent> = {
  title: 'Modals/Create Target Modal',
  component: CreateTargetModalContent,
};

export default meta;
type Story = StoryObj<typeof CreateTargetModalContent>;

const formSchema = z.object({
  targetName: z
    .string({
      required_error: 'Target name is required',
    })
    .min(2, {
      message: 'Target name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Target name must be at most 50 characters long',
    })
    .regex(
      /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
      'Target name restricted to alphanumerical characters, spaces and . , _ - / &',
    ),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        targetName: '',
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
