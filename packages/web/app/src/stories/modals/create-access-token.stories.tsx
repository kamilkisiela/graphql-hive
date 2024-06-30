import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usePermissionsManager } from '@/components/organization/Permissions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  CreateAccessTokenModal,
  CreatedTokenContent,
  GenerateTokenContent,
} from '@/components/ui/modal/create-access-token';
import { TargetAccessScope } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { DialogTrigger } from '@radix-ui/react-dialog';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreateAccessTokenModal> = {
  title: 'Modals/Create Access Token',
  component: CreateAccessTokenModal,
};

export default meta;
type Story = StoryObj<typeof CreateAccessTokenModal>;

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Token description is required',
  }),
});

export const GenerateToken: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        name: '',
      },
    });
    const manager = {
      canAccessOrganization: () => true,
      canAccessProject: () => true,
      canAccessTarget: () => true,
      noneSelected: false,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [],
      setOrganizationScopes: () => {},
      setProjectScopes: () => {},
      setTargetScopes: () => {},
      submit: () => {},
    } as unknown as ReturnType<typeof usePermissionsManager>;

    const [selectedScope, setSelectedScope] = useState(
      'no-access' as TargetAccessScope | 'no-access',
    );
    const noPermissionsSelected = selectedScope === 'no-access';

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={toggleModalOpen}>Open Modal</Button>
        </DialogTrigger>
        <GenerateTokenContent
          form={form}
          manager={manager}
          noPermissionsSelected={noPermissionsSelected}
          onSubmit={() => console.log('submit')}
          selectedScope="no-access"
          setSelectedScope={setSelectedScope}
          toggleModalOpen={toggleModalOpen}
          key="generate-token-content"
        />
      </Dialog>
    );
  },
};

export const CreatedToken: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={toggleModalOpen}>Open Modal</Button>
        </DialogTrigger>
        <CreatedTokenContent
          mutation={{
            fetching: false,
            data: {
              createToken: {
                ok: true,
              },
            },
            stale: false,
          }}
          toggleModalOpen={toggleModalOpen}
        />
      </Dialog>
    );
  },
};
