import type { Meta, StoryObj } from '@storybook/react';
import { GetStartedWizard } from '../components/get-started/wizard';

const meta: Meta<typeof GetStartedWizard> = {
  title: 'Get Started Wizard',
  component: GetStartedWizard,
};

export default meta;
type Story = StoryObj<typeof GetStartedWizard>;

export const Default: Story = {
  render: () => (
    <div className="flex h-[600px] w-full flex-row items-start justify-center bg-black pt-12">
      <GetStartedWizard
        isOpen
        onClose={() => {}}
        docsUrl={path => `https://the-guild.dev/graphql/hive/docs${path}`}
        tasks={{
          creatingProject: true,
          checkingSchema: true,
          publishingSchema: true,
          reportingOperations: false,
          enablingUsageBasedBreakingChanges: false,
          invitingMembers: false,
        }}
      />
    </div>
  ),
};
