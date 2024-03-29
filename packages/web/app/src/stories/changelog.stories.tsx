import type { Meta, StoryObj } from '@storybook/react';
import { Changelog } from '../components/ui/changelog/changelog';

const meta: Meta<typeof Changelog> = {
  title: 'Changelog',
  component: Changelog,
};

export default meta;
type Story = StoryObj<typeof Changelog>;

const changes = [
  {
    date: 'February 26, 2024',
    href: 'https://the-guild.dev/graphql/hive/product-updates/2024-02-26-schema-check-top-affected-operations',
    title: 'Top affected operations based on conditional breaking change configuration',
    description:
      'We now show you the top affected operations and clients based on the conditional breaking change configuration. This allows you to see the impact of your changes before you approve or reject them.',
  },
  {
    date: 'February 8, 2024',
    href: 'https://the-guild.dev/graphql/hive/product-updates/2024-02-08-upcoming-stitching-project-changes',
    title: 'Upcoming changes to schema composition for Schema Stitching projects',
    description:
      'Due to stitching limitations we need to slightly alter the schema composition behaviour for more predictable results.',
  },
];

export const Default: Story = {
  render: () => (
    <div className="flex h-[600px] w-full flex-row items-start justify-center bg-black pt-12">
      <Changelog changes={changes} />
    </div>
  ),
};
