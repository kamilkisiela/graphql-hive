import { UseMutationState } from 'urql';
import { DeleteCDNAccessTokenModalContent } from '@/components/target/settings/cdn-access-tokens';
import { CdnAccessTokens_DeleteCdnAccessTokenMutation } from '@/gql/graphql';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const meta: Meta<typeof DeleteCDNAccessTokenModalContent> = {
  title: 'Modals/Delete CDN Access Token Modal',
  component: DeleteCDNAccessTokenModalContent,
  argTypes: {
    deleteCdnAccessToken: {
      control: {
        type: 'object',
      },
    },
    onClose: {
      action: 'onClose',
    },
    onConfirmDelete: {
      action: 'onConfirmDelete',
    },
  },
};

export default meta;

type Story = StoryObj<typeof DeleteCDNAccessTokenModalContent>;

const Template: StoryFn<typeof DeleteCDNAccessTokenModalContent> = args => {
  return <DeleteCDNAccessTokenModalContent {...args} />;
};

export const Default: Story = Template.bind({});
Default.args = {
  deleteCdnAccessToken: {
    data: {
      __typename: 'Mutation',
      deleteCdnAccessToken: {
        __typename: 'DeleteCdnAccessTokenResult',
        error: null,
        ok: null,
      },
    },
    fetching: false,
    stale: false,
  } as UseMutationState<CdnAccessTokens_DeleteCdnAccessTokenMutation>,
};

export const Success: Story = Template.bind({});
Success.args = {
  deleteCdnAccessToken: {
    data: {
      __typename: 'Mutation',
      deleteCdnAccessToken: {
        __typename: 'DeleteCdnAccessTokenResult',
        error: null,
        ok: {
          __typename: 'DeleteCdnAccessTokenOk',
          deletedCdnAccessTokenId: '1',
        },
      },
    },
    fetching: false,
    stale: false,
  } as UseMutationState<CdnAccessTokens_DeleteCdnAccessTokenMutation>,
};

export const Error: Story = Template.bind({});
Error.args = {
  deleteCdnAccessToken: {
    data: {
      __typename: 'Mutation',
      deleteCdnAccessToken: {
        __typename: 'DeleteCdnAccessTokenResult',
        error: {
          __typename: 'DeleteCdnAccessTokenError',
          message: 'Failed to delete the CDN Access Token.',
        },
        ok: null,
      },
    },
    fetching: false,
    stale: false,
  } as UseMutationState<CdnAccessTokens_DeleteCdnAccessTokenMutation>,
};
