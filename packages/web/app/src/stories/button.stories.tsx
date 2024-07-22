import { ArrowBigDown, ArrowDown } from 'lucide-react';
import { Button, SIZE, VARIANT } from '@/components/ui/button';
import type { Meta, StoryObj } from '@storybook/react';

const VARIANTS = [
  'default',
  'orangeLink',
  'link',
  'ghost',
  'secondary',
  'outline',
  'destructive',
  'primary',
] as const satisfies (keyof typeof VARIANT)[];

const SIZES = ['default', 'sm', 'lg', 'icon', 'icon-sm'] as const satisfies (keyof typeof SIZE)[];

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: VARIANTS,
    },
    size: {
      control: { type: 'select' },
      options: SIZES,
    },
    asChild: {
      control: { type: 'boolean' },
    },
  },
  args: {
    variant: 'default',
    size: 'default',
    asChild: false,
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Default Button',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

export const OrangeLink: Story = {
  args: {
    variant: 'orangeLink',
    children: 'Orange Link Button',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: <ArrowBigDown />,
  },
};

export const IconSmall: Story = {
  args: {
    size: 'icon-sm',
    children: <ArrowDown />,
  },
};
