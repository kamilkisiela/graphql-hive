import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { UserSettingsModalContent, UserSettingsModalFormValues } from '@/components/ui/user-menu';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const userSettingsModalFormSchema = z.object({
  fullName: z
    .string({
      required_error: 'Full Name is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    }),
  displayName: z
    .string({
      required_error: 'Display Name is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    }),
});

const meta: Meta<typeof UserSettingsModalContent> = {
  title: 'Modals/User Settings Modal',
  component: UserSettingsModalContent,
  argTypes: {
    toggleModalOpen: {
      action: 'close',
    },
    form: {
      control: {
        type: 'object',
      },
    },
    isOpen: {
      control: {
        type: 'boolean',
      },
    },
    onSubmit: {
      action: 'onSubmit',
    },
    fetching: {
      control: {
        type: 'boolean',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof UserSettingsModalContent>;

const Template: StoryFn<typeof UserSettingsModalContent> = args => {
  const form = useForm<UserSettingsModalFormValues>({
    mode: 'onChange',
    resolver: zodResolver(userSettingsModalFormSchema),
    defaultValues: {
      fullName: 'John Doe',
      displayName: 'John',
    },
  });
  return <UserSettingsModalContent {...args} form={form} />;
};

export const UserSettings: Story = Template.bind({});
UserSettings.args = {
  isOpen: true,
  toggleModalOpen: () => console.log('Close'),
};
