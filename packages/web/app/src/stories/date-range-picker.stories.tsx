import {
  availablePresets,
  DateRangePicker,
  DateRangePickerProps,
} from '@/components/ui/date-range-picker';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DateRangePicker> = {
  title: 'Components/DateRangePicker',
  component: DateRangePicker,
};

export default meta;

type Story = StoryObj<typeof DateRangePicker>;

const Template = (args: DateRangePickerProps) => <DateRangePicker {...args} />;

export const Primary: Story = {
  name: 'Primary',
  render: Template,
  args: {
    selectedRange: { from: 'now-1d', to: 'now' },
  },
};

export const WithPresets: Story = {
  name: 'With presets',
  render: Template,
  args: {
    presets: availablePresets,
  },
};

export const WithSelectedRange: Story = {
  name: 'With selected range',
  render: Template,
  args: {
    selectedRange: { from: '2024-04-01', to: '2024-04-15' },
  },
};
