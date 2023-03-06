import type { Meta, StoryObj } from '@storybook/react';
import { Callout } from '../components/v2';

const meta: Meta<typeof Callout> = {
  title: 'Callout',
  component: Callout,
};

export default meta;
type Story = StoryObj<typeof Callout>;

export const Default: Story = {
  render: () => <Callout>Hello</Callout>,
};

export const Error: Story = {
  render: () => <Callout type="error">Hello</Callout>,
};

export const Info: Story = {
  render: () => <Callout type="info">Hello</Callout>,
};

export const Warning: Story = {
  render: () => <Callout type="warning">Hello</Callout>,
};

export const Long: Story = {
  render: () => (
    <Callout type="warning">
      <b>Your organization is being rate-limited for operations.</b>
      <br />
      Since you reached your organization rate-limit and data ingestion limitation, your
      organization <b>The Guild</b> is currently unable to ingest data.
    </Callout>
  ),
};
