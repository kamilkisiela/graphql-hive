import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CreateProjectModal, CreateProjectModalContent } from '@/components/ui/create-project';
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
  projectName: z
    .string({
      required_error: 'Project name is required',
    })
    .min(2, {
      message: 'Project name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Project name must be at most 50 characters long',
    })
    .regex(
      /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
      'Project name restricted to alphanumerical characters, spaces and . , _ - / &',
    ),
  projectType: z.nativeEnum(ProjectType, {
    required_error: 'Project type is required',
  }),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        projectName: '',
        projectType: ProjectType.Single,
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
