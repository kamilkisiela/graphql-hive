import { ConnectLabModalContent } from '@/components/target/laboratory/connect-lab-modal';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const meta: Meta<typeof ConnectLabModalContent> = {
  title: 'Modals/Connect Lab Modal',
  component: ConnectLabModalContent,
  argTypes: {
    isOpen: {
      control: 'boolean',
    },
    close: {
      action: 'close',
    },
    docsUrl: {
      control: 'text',
    },
    endpoint: {
      control: 'text',
    },
    isCDNEnabled: {
      control: 'boolean',
    },
  },
};

export default meta;

type Story = StoryObj<typeof ConnectLabModalContent>;

const Template: StoryFn<typeof ConnectLabModalContent> = args => {
  return <ConnectLabModalContent {...args} />;
};

export const isCDNEnabled: Story = Template.bind({});
isCDNEnabled.args = {
  isOpen: true,
  close: () => console.log('Close'),
  docsUrl: 'https://example.com',
  endpoint: 'https://example.com',
  isCDNEnabled: true,
};

export const isCDNDisabled: Story = Template.bind({});
isCDNDisabled.args = {
  isOpen: true,
  close: () => console.log('Close'),
  docsUrl: 'https://example.com',
  endpoint: 'https://example.com',
  isCDNEnabled: false,
};
