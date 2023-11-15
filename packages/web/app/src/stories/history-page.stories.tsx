import { VersionErrorsAndChanges } from '@/components/target/history/errors-and-changes';
import { CriticalityLevel } from '@/graphql';
import type { Meta, StoryObj } from '@storybook/react';

const changes = [
  {
    message: 'Type "Foo" was removed',
    criticality: CriticalityLevel.Breaking,
    isSafeBasedOnUsage: false,
  },
  {
    message: 'Input field "limit" was added to input object type "Filter"',
    criticality: CriticalityLevel.Breaking,
    isSafeBasedOnUsage: false,
  },
  {
    message: 'Field "User.nickname" is no longer deprecated',
    criticality: CriticalityLevel.Dangerous,
    isSafeBasedOnUsage: false,
  },
  {
    message: 'Field "type" was added to object type "User"',
    criticality: CriticalityLevel.Safe,
    isSafeBasedOnUsage: false,
  },
];

const errors = [
  {
    message: 'Field "Foo.id" can only be defined once.',
  },
  {
    message:
      '[subgraph-a] Foo.name -> is marked as @external but is not used by a @requires, @key, or @provides directive.',
  },
  {
    message:
      '[subgraph-b] Foo.name -> is marked as @external but is not used by a @requires, @key, or @provides directive.',
  },
];

const meta: Meta<typeof VersionErrorsAndChanges> = {
  title: 'VersionErrorsAndChanges',
  component: VersionErrorsAndChanges,
};

export default meta;
type Story = StoryObj<typeof VersionErrorsAndChanges>;

export const Changes: Story = {
  render: () => {
    return (
      <div className="dark">
        <VersionErrorsAndChanges
          changes={{
            nodes: changes,
            total: changes.length,
          }}
          errors={{
            nodes: [],
            total: 0,
          }}
        />
      </div>
    );
  },
};

export const Errors: Story = {
  render: () => {
    return (
      <VersionErrorsAndChanges
        errors={{
          nodes: errors,
          total: errors.length,
        }}
        changes={{
          nodes: [],
          total: 0,
        }}
      />
    );
  },
};

export const Both: Story = {
  render: () => {
    return (
      <VersionErrorsAndChanges
        errors={{
          nodes: errors,
          total: errors.length,
        }}
        changes={{
          nodes: changes,
          total: changes.length,
        }}
      />
    );
  },
};
