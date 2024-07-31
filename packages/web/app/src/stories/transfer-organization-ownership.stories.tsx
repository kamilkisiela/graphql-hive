import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  MemberFieldsFragment,
  TransferOrganizationOwnershipModal_OrganizationFragmentFragment,
} from '@/gql/graphql';
import { TransferOrganizationOwnershipModalContent } from '@/pages/organization-settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof TransferOrganizationOwnershipModalContent> = {
  title: 'Modals/Transfer Organization Ownership Modal',
  component: TransferOrganizationOwnershipModalContent,
};

export default meta;
type Story = StoryObj<typeof TransferOrganizationOwnershipModalContent>;

const TransferOrganizationOwnershipFormSchema = z.object({
  newOwner: z
    .string({
      required_error: 'New owner is required',
    })
    .min(1, {
      message: 'New owner is required',
    }),
  confirmation: z
    .string({
      required_error: 'Confirmation is required',
    })
    .min(1, {
      message: 'Confirmation is required',
    }),
});

export const Default: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    const form = useForm<z.infer<typeof TransferOrganizationOwnershipFormSchema>>({
      mode: 'onChange',
      resolver: zodResolver(TransferOrganizationOwnershipFormSchema),
      defaultValues: {
        newOwner: '',
        confirmation: '',
      },
    });

    function handleSubmit() {
      void form.handleSubmit(data => {
        console.log(data);
      })();
    }

    const mockMembers: MemberFieldsFragment[] = [
      {
        id: '1',
        __typename: 'Member',
        isOwner: false,
        organizationAccessScopes: [],
        projectAccessScopes: [],
        targetAccessScopes: [],
        user: {
          id: '1',
          __typename: 'User',
          displayName: 'Test User 1',
          email: 'fakeUser@fake.com',
          fullName: 'Test User 1',
        },
        ' $fragmentName': 'MemberFieldsFragment',
      },
      {
        id: '2',
        __typename: 'Member',
        isOwner: false,
        organizationAccessScopes: [],
        projectAccessScopes: [],
        targetAccessScopes: [],
        user: {
          id: '2',
          __typename: 'User',
          displayName: 'Test User 2',
          email: 'fakeUser2@fake.com',
          fullName: 'Test User 2',
        },
        ' $fragmentName': 'MemberFieldsFragment',
      },
    ];

    const mockOrganization: TransferOrganizationOwnershipModal_OrganizationFragmentFragment = {
      id: '1',
      __typename: 'Organization',
      cleanId: 'test-org',
    };

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <TransferOrganizationOwnershipModalContent
            form={form}
            isOpen={openModal}
            toggleModalOpen={toggleModalOpen}
            onSubmit={handleSubmit}
            members={mockMembers}
            organization={mockOrganization}
          />
        )}
      </>
    );
  },
};
