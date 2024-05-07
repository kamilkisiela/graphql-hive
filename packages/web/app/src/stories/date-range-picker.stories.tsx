import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DateRangePicker> = {
  title: 'Date Range Picker',
  component: DateRangePicker,
};

export default meta;
type Story = StoryObj<typeof DateRangePicker>;

export const Default: Story = {
  render: () => <DateRangePicker />,
};
