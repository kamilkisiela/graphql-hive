import { Meta, StoryObj } from '@storybook/react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Callout } from '@/components/ui/callout';

const meta: Meta<typeof Callout> = {
  title: 'Components/Callout',
  component: Callout,
  argTypes: {
    type: {
      control: { type: 'inline-radio' },
      options: ['default', 'error', 'info', 'warning'],
    },
    emoji: {
      control: { type: 'text' },
    },
    children: {
      control: { type: 'text' },
    },
  },
  args: {
    type: 'default',
    emoji: '💡',
    children: 'This is a callout',
  },
};

export default meta;

type Story = StoryObj<typeof Callout>;

export const Default: Story = {};

export const Error: Story = {
  args: {
    type: 'error',
    emoji: '🚫',
    children: 'This is an error callout',
  },
};

export const Info: Story = {
  args: {
    type: 'info',
    emoji: <InfoCircledIcon className="h-6 w-auto" />,
    children: 'This is an info callout',
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    emoji: '⚠️',
    children: 'This is a warning callout',
  },
};
