import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CreateProjectModalContent } from '@/components/layouts/organization';
import { Button } from '@/components/ui/button';
import { ProjectType } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateProjectModalContent> = {
  title: 'Modals/Create Project Modal',
  component: CreateProjectModalContent,
};

export default meta;
type Story = StoryObj<typeof CreateProjectModalContent>;

const formSchema = z.object({
  projectSlug: z
    .string({
      required_error: 'Project slug is required',
    })
    .min(2, {
      message: 'Project slug must be at least 2 characters long',
    })
    .max(50, {
      message: 'Project slug must be at most 50 characters long',
    }),
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
        projectSlug: '',
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
