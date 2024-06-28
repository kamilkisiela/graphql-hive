import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TransferOrganizationOwnershipContent } from '@/components/ui/modal/transfer-organization-ownership';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof TransferOrganizationOwnershipContent> = {
  title: 'Modals/Transfer Organization Ownership Modal',
  component: TransferOrganizationOwnershipContent,
};

export default meta;
type Story = StoryObj<typeof TransferOrganizationOwnershipContent>;

const formSchema = z.object({
  newOwner: z.string().min(1, 'New owner is not defined'),
  confirmation: z.string().min(1, 'Organization name is not defined'),
});

export const WithOutMembers: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: { newOwner: '', confirmation: '' },
    });

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <FormProvider {...form}>
            <div>
              <TransferOrganizationOwnershipContent
                form={form}
                isOpen={openModal}
                members={[]}
                onSubmit={() => console.log('submit')}
                toggleModalOpen={toggleModalOpen}
                organizationCleanId="organizationCleanId"
                handleRoute={() => console.log('handleRoute')}
              />
            </div>
          </FormProvider>
        )}
      </>
    );
  },
};

export const WithMembers: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);
    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: { newOwner: '', confirmation: '' },
    });

    return (
      <>
        <Button onClick={toggleModalOpen}>Open Modal</Button>
        {openModal && (
          <FormProvider {...form}>
            <div>
              <TransferOrganizationOwnershipContent
                form={form}
                isOpen={openModal}
                members={[
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
                      displayName: 'Test User',
                      email: 'test@gmail.com',
                      fullName: 'Test User',
                    },
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
                      displayName: 'Test User',
                      email: 'test@gmail.com',
                      fullName: 'Test User',
                    },
                  },
                  {
                    id: '3',
                    __typename: 'Member',
                    isOwner: false,
                    organizationAccessScopes: [],
                    projectAccessScopes: [],
                    targetAccessScopes: [],
                    user: {
                      id: '3',
                      __typename: 'User',
                      displayName: 'Test User',
                      email: 'test@gmail.com',
                      fullName: 'Test User',
                    },
                  },
                  {
                    id: '4',
                    __typename: 'Member',
                    isOwner: false,
                    organizationAccessScopes: [],
                    projectAccessScopes: [],
                    targetAccessScopes: [],
                    user: {
                      id: '4',
                      __typename: 'User',
                      displayName: 'Test User',
                      email: 'test@gmail.com',
                      fullName: 'Test User',
                    },
                  },
                ]}
                onSubmit={() => console.log('submit')}
                toggleModalOpen={toggleModalOpen}
                organizationCleanId="organizationCleanId"
                handleRoute={() => console.log('handleRoute')}
              />
            </div>
          </FormProvider>
        )}
      </>
    );
  },
};
