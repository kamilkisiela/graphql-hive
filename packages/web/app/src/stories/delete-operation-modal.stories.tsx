import { DeleteOperationModalContent } from '@/components/target/laboratory/delete-operation-modal';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const meta: Meta<typeof DeleteOperationModalContent> = {
  title: 'Modals/Delete Operation Modal',
  component: DeleteOperationModalContent,
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

type Story = StoryObj<typeof DeleteOperationModalContent>;

const Template: StoryFn<typeof DeleteOperationModalContent> = args => {
  return <DeleteOperationModalContent {...args} />;
};

export const Delete: Story = Template.bind({});
Delete.args = {
  isOpen: true,
  toggleModalOpen: () => console.log('Close'),
  handleDelete: () => console.log('Delete'),
};
