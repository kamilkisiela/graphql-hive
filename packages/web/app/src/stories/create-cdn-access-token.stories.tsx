import { useForm } from 'react-hook-form';
import { UseMutationState } from 'urql';
import { z } from 'zod';
import { CreateCDNAccessTokenModalContent } from '@/components/target/settings/cdn-access-tokens';
import { CdnAccessTokens_CdnAccessTokenCreateMutationMutation } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

const createCDNAccessTokenModalFormSchema = z.object({
  alias: z.string().min(3).max(100),
});

type CreateCDNAccessTokenModalFormValues = z.infer<typeof createCDNAccessTokenModalFormSchema>;

const meta: Meta<typeof CreateCDNAccessTokenModalContent> = {
  title: 'Modals/Create CDN Access Token Modal',
  component: CreateCDNAccessTokenModalContent,
  argTypes: {
    createCdnAccessToken: {
      control: {
        type: 'object',
      },
    },
    onClose: {
      action: 'onClose',
    },
    form: {
      control: {
        type: 'object',
      },
    },
    onSubmit: {
      action: 'onSubmit',
    },
  },
};

export default meta;

type Story = StoryObj<typeof CreateCDNAccessTokenModalContent>;

const Template: StoryFn<typeof CreateCDNAccessTokenModalContent> = args => {
  const defaultValues: CreateCDNAccessTokenModalFormValues = {
    alias: '',
  };
  const form = useForm<CreateCDNAccessTokenModalFormValues>({
    mode: 'onBlur',
    defaultValues,
    resolver: zodResolver(createCDNAccessTokenModalFormSchema),
  });

  return <CreateCDNAccessTokenModalContent {...args} form={form} />;
};

export const Default: Story = Template.bind({});
Default.args = {
  createCdnAccessToken: {
    fetching: false,
    stale: false,
    data: null,
  } as unknown as UseMutationState<CdnAccessTokens_CdnAccessTokenCreateMutationMutation>,
};

export const Success: Story = Template.bind({});
Success.args = {
  createCdnAccessToken: {
    fetching: false,
    stale: false,
    data: {
      __typename: 'Mutation',
      createCdnAccessToken: {
        __typename: 'CdnAccessTokenCreateResult',
        error: null,
        ok: {
          __typename: 'CdnAccessTokenCreateOk',
          createdCdnAccessToken: {
            __typename: 'CdnAccessToken',
            id: '1',
          },
          secretAccessToken: 'Secret Token!!!',
        },
      },
    },
  } as UseMutationState<CdnAccessTokens_CdnAccessTokenCreateMutationMutation>,
};

export const Error: Story = Template.bind({});
Error.args = {
  createCdnAccessToken: {
    fetching: false,
    stale: false,
    data: {
      __typename: 'Mutation',
      createCdnAccessToken: {
        __typename: 'CdnAccessTokenCreateResult',
        error: {
          __typename: 'CdnAccessTokenCreateError',
          message: 'Failed to create the CDN Access Token.',
        },
        ok: null,
      },
    },
  } as UseMutationState<CdnAccessTokens_CdnAccessTokenCreateMutationMutation>,
};
