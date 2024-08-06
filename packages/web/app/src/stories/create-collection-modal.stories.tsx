import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CreateCollectionModalContent,
  CreateCollectionModalFormValues,
} from '@/components/target/laboratory/create-collection-modal';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const createCollectionModalFormSchema = z.object({
  name: z
    .string({
      required_error: 'Collection name is required',
    })
    .min(2, {
      message: 'Collection name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Collection name must be at most 50 characters long',
    }),
  description: z.string().optional(),
});

const meta: Meta<typeof CreateCollectionModalContent> = {
  title: 'Modals/Create Collection Modal',
  component: CreateCollectionModalContent,
  argTypes: {
    collectionId: {
      control: {
        type: 'text',
      },
    },
    fetching: {
      control: {
        type: 'boolean',
      },
    },
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof CreateCollectionModalContent>;

const Template: StoryFn<typeof CreateCollectionModalContent> = args => {
  const form = useForm<CreateCollectionModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createCollectionModalFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!args.collectionId) {
      form.reset();
    } else {
      void form.setValue('name', args.collectionId);
    }
  }, [args.collectionId]);

  return <CreateCollectionModalContent {...args} form={form} />;
};

export const Create: Story = Template.bind({});
Create.args = {
  collectionId: '',
  fetching: false,
  isOpen: true,
  toggleModalOpen: () => console.log('Toggle Modal Open'),
  onSubmit: data => console.log('Submit', data),
};

export const Update: Story = Template.bind({});
Update.args = {
  collectionId: 'collectionId',
  fetching: false,
  isOpen: true,
  toggleModalOpen: () => console.log('Toggle Modal Open'),
  onSubmit: data => console.log('Submit', data),
};
