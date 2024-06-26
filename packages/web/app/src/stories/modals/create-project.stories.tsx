import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  CreateProjectModal,
  CreateProjectModalContent,
} from '@/components/ui/modal/create-project';
import { ProjectType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateProjectModal> = {
  title: 'Modals/Create Project Modal',
  component: CreateProjectModal,
};

export default meta;
type Story = StoryObj<typeof CreateProjectModal>;

const formSchema = z.object({
  name: z.string().min(1, {
    message: 'Project name is required',
  }),
  type: z.nativeEnum(ProjectType, {
    message: 'Project type is required',
  }),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: '',
        type: ProjectType.Single,
      },
    });

    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <CreateProjectModalContent
            isOpen={openModal}
            toggleModalOpen={toggleModalOpen}
            form={form}
            onSubmit={() => console.log('Submit')}
            key="create-project-modal"
          />
        )}
      </>
    );
  },
};
