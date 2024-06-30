import { Tag } from '@/components/ui/tag';
import { Meta, StoryObj } from '@storybook/react';

const colors = {
  green: 'bg-green-500/10 text-green-500',
  yellow: 'bg-yellow-500/10 text-yellow-500',
  gray: 'bg-gray-500/10 text-gray-500',
} as const;

const meta: Meta<typeof Tag> = {
  title: 'Components/Tag',
  component: Tag,
};

export default meta;

type Story = StoryObj<typeof Tag>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Tag color="green">Green Tag</Tag>
      <Tag color="yellow">Yellow Tag</Tag>
      <Tag color="gray">Gray Tag</Tag>
      <Tag className="w-full">
        X-Hive-CDN-Key: {'<'}Your Access Token{'>'}
      </Tag>
    </div>
  ),
};
