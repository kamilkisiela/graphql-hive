import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CreateOrganizationFormContent } from '@/pages/organization-new';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateOrganizationFormContent> = {
  title: 'Modals/Create Organization Modal',
  component: CreateOrganizationFormContent,
};

export default meta;
type Story = StoryObj<typeof CreateOrganizationFormContent>;

const formSchema = z.object({
  slug: z
    .string({
      required_error: 'Organization slug is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    }),
});

export const Default: Story = {
  render: () => {
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        slug: '',
      },
    });

    return (
      <CreateOrganizationFormContent
        form={form}
        onSubmit={() => console.log('Submit')}
        key="create-organization-form"
      />
    );
  },
};
