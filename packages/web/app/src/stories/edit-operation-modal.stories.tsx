import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  EditOperationModalContent,
  EditOperationModalFormValues,
} from '@/components/target/laboratory/edit-operation-modal';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const editOperationModalFormSchema = z.object({
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

const meta: Meta<typeof EditOperationModalContent> = {
  title: 'Modals/Edit Operation Modal',
  component: EditOperationModalContent,
  argTypes: {
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    opreationId: {
      control: {
        type: 'text',
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
    onSubmit: {
      action: 'onSubmit',
    },
  },
};

export default meta;

type Story = StoryObj<typeof EditOperationModalContent>;

const Template: StoryFn<typeof EditOperationModalContent> = args => {
  const form = useForm<EditOperationModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(editOperationModalFormSchema),
    defaultValues: {
      name: args.opreationId,
      collectionId: args.opreationId,
    },
  });

  useEffect(() => {
    form.reset({
      name: args.opreationId,
      collectionId: args.opreationId,
    });
  }, [args.opreationId]);

  return <EditOperationModalContent {...args} form={form} />;
};

export const Default: Story = Template.bind({});
Default.args = {
  close: () => {},
  isOpen: true,
  fetching: false,
};
