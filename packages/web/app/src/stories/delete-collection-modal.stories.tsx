import { DeleteCollectionModalContent } from '@/components/target/laboratory/delete-collection-modal';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const meta: Meta<typeof DeleteCollectionModalContent> = {
  title: 'Modals/Delete Collection Modal',
  component: DeleteCollectionModalContent,
  argTypes: {
    isOpen: {
      control: 'boolean',
    },
    toggleModalOpen: {
      action: 'toggleModalOpen',
    },
    handleDelete: {
      action: 'onSubmit',
    },
  },
};

export default meta;

type Story = StoryObj<typeof DeleteCollectionModalContent>;

const Template: StoryFn<typeof DeleteCollectionModalContent> = args => {
  return <DeleteCollectionModalContent {...args} />;
};

export const Delete: Story = Template.bind({});
Delete.args = {
  isOpen: true,
  toggleModalOpen: () => console.log('Close'),
  handleDelete: () => console.log('Delete'),
};
