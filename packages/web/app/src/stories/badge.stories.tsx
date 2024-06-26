import {
  Badge,
  BadgeProps,
  BadgeRounded,
  BadgeRoundedProps,
  badgeRoundedVariants,
  badgeVariants,
} from '@/components/ui/badge';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Components/Badge',
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: Object.keys(badgeVariants({ variant: 'default' })),
    },
    color: {
      control: { type: 'select' },
      options: Object.keys(badgeRoundedVariants({ color: 'green' })),
    },
  },
};

export default meta;

// Badge Stories
const BadgeTemplate = (args: BadgeProps) => <Badge {...args} />;

export const DefaultBadge: StoryObj<typeof Badge> = {
  name: 'Default Badge',
  render: BadgeTemplate,
  args: {
    variant: 'default',
    children: 'Default Badge',
  },
};

export const SecondaryBadge: StoryObj<typeof Badge> = {
  name: 'Secondary Badge',
  render: BadgeTemplate,
  args: {
    variant: 'secondary',
    children: 'Secondary Badge',
  },
};

export const DestructiveBadge: StoryObj<typeof Badge> = {
  name: 'Destructive Badge',
  render: BadgeTemplate,
  args: {
    variant: 'destructive',
    children: 'Destructive Badge',
  },
};

export const OutlineBadge: StoryObj<typeof Badge> = {
  name: 'Outline Badge',
  render: BadgeTemplate,
  args: {
    variant: 'outline',
    children: 'Outline Badge',
  },
};

// BadgeRounded Stories
const BadgeRoundedTemplate = (args: BadgeRoundedProps) => <BadgeRounded {...args} />;

export const RedBadgeRounded: StoryObj<typeof BadgeRounded> = {
  name: 'Red BadgeRounded',
  render: BadgeRoundedTemplate,
  args: {
    color: 'red',
  },
};

export const YellowBadgeRounded: StoryObj<typeof BadgeRounded> = {
  name: 'Yellow BadgeRounded',
  render: BadgeRoundedTemplate,
  args: {
    color: 'yellow',
  },
};

export const GreenBadgeRounded: StoryObj<typeof BadgeRounded> = {
  name: 'Green BadgeRounded',
  render: BadgeRoundedTemplate,
  args: {
    color: 'green',
  },
};

export const GrayBadgeRounded: StoryObj<typeof BadgeRounded> = {
  name: 'Gray BadgeRounded',
  render: BadgeRoundedTemplate,
  args: {
    color: 'gray',
  },
};

export const OrangeBadgeRounded: StoryObj<typeof BadgeRounded> = {
  name: 'Orange BadgeRounded',
  render: BadgeRoundedTemplate,
  args: {
    color: 'orange',
  },
};
