import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  CreateOperationModalContent,
  CreateOperationModalFormValues,
} from '@/components/target/laboratory/create-operation-modal';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const createOperationModalFormSchema = z.object({
  name: z
    .string({
      required_error: 'Operation name is required',
    })
    .min(2, {
      message: 'Operation name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Operation name must be less than 50 characters long',
    }),
  collectionId: z.string({
    required_error: 'Collection is required',
  }),
});

const meta: Meta<typeof CreateOperationModalContent> = {
  title: 'Modals/Create Operation Modal',
  component: CreateOperationModalContent,
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    fetching: {
      control: {
        type: 'boolean',
      },
    },
    close: {
      action: 'close',
    },
    collections: {
      control: {
        type: 'object',
      },
    },
    onSubmit: {
      action: 'onSubmit',
    },
  },
};

export default meta;

type Story = StoryObj<typeof CreateOperationModalContent>;

const Template: StoryFn<typeof CreateOperationModalContent> = args => {
  const form = useForm<CreateOperationModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(createOperationModalFormSchema),
    defaultValues: {
      name: '',
      collectionId: '',
    },
  });

  return <CreateOperationModalContent {...args} form={form} />;
};

export const Default: Story = Template.bind({});
Default.args = {
  isOpen: true,
  close: () => {},
  collections: [
    // @ts-expect-error -- Tuval: these types are invalid
    {
      id: '1',
      name: 'Collection 1',
      __typename: 'DocumentCollection',
      description: 'Collection 1 description',
    },
    // @ts-expect-error -- Tuval: these types are invalid
    {
      id: '2',
      name: 'Collection 2',
      __typename: 'DocumentCollection',
      description: 'Collection 2 description',
    },
    // @ts-expect-error -- Tuval: these types are invalid
    {
      id: '3',
      name: 'Collection 3',
      __typename: 'DocumentCollection',
      description: 'Collection 3 description',
    },
  ],
  fetching: false,
  onSubmit: () => {},
};
