import { ArrowBigDown, ArrowDown } from 'lucide-react';
import { Button, ButtonProps, buttonVariants } from '@/components/ui/button';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: Object.keys(
        buttonVariants({
          variant: 'default',
          size: 'default',
          className: 'className',
        }),
      ),
    },
    size: {
      control: { type: 'select' },
      options: Object.keys(
        buttonVariants({
          variant: 'default',
          size: 'default',
          className: 'className',
        }),
      ),
    },
    asChild: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

const Template = (args: ButtonProps) => <Button {...args} />;

export const Default: Story = {
  name: 'Default',
  render: Template,
  args: {
    variant: 'default',
    size: 'default',
    children: 'Default Button',
  },
};

export const Destructive: Story = {
  name: 'Destructive',
  render: Template,
  args: {
    variant: 'destructive',
    size: 'default',
    children: 'Destructive Button',
  },
};

export const Outline: Story = {
  name: 'Outline',
  render: Template,
  args: {
    variant: 'outline',
    size: 'default',
    children: 'Outline Button',
  },
};

export const Secondary: Story = {
  name: 'Secondary',
  render: Template,
  args: {
    variant: 'secondary',
    size: 'default',
    children: 'Secondary Button',
  },
};

export const Ghost: Story = {
  name: 'Ghost',
  render: Template,
  args: {
    variant: 'ghost',
    size: 'default',
    children: 'Ghost Button',
  },
};

export const Link: Story = {
  name: 'Link',
  render: Template,
  args: {
    variant: 'link',
    size: 'default',
    children: 'Link Button',
  },
};

export const OrangeLink: Story = {
  name: 'OrangeLink',
  render: Template,
  args: {
    variant: 'orangeLink',
    size: 'default',
    children: 'Orange Link Button',
  },
};

export const Small: Story = {
  name: 'Small',
  render: Template,
  args: {
    variant: 'default',
    size: 'sm',
    children: 'Small Button',
  },
};

export const Large: Story = {
  name: 'Large',
  render: Template,
  args: {
    variant: 'default',
    size: 'lg',
    children: 'Large Button',
  },
};

export const Icon: Story = {
  name: 'Icon',
  render: Template,
  args: {
    variant: 'default',
    size: 'icon',
    children: <ArrowBigDown />,
  },
};

export const IconSmall: Story = {
  name: 'IconSmall',
  render: Template,
  args: {
    variant: 'default',
    size: 'icon-sm',
    children: <ArrowDown />,
  },
};
