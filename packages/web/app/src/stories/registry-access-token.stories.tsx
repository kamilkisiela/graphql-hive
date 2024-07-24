import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usePermissionsManager } from '@/components/organization/Permissions';
import {
  CreatedTokenContent,
  GenerateTokenContent,
} from '@/components/target/settings/registry-access-token';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { TargetAccessScope } from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof CreatedTokenContent> = {
  title: 'Modals/Create Access Token',
  component: CreatedTokenContent,
};

export default meta;
type Story = StoryObj<typeof CreatedTokenContent>;

const formSchema = z.object({
  tokenDescription: z
    .string()
    .min(2, { message: 'Token description must be at least 2 characters long' }),
});

export const GenerateToken: Story = {
  render: () => {
    const [openModal, setOpenModal] = useState(false);
    const toggleModalOpen = () => setOpenModal(!openModal);

    const form = useForm<z.infer<typeof formSchema>>({
      mode: 'onChange',
      resolver: zodResolver(formSchema),
      defaultValues: {
        tokenDescription: '',
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

    const [selectedScope, setSelectedScope] = useState<'no-access' | TargetAccessScope>(
      'no-access',
    );
    const noPermissionsSelected = selectedScope === 'no-access';

    return (
      <Dialog open={openModal} onOpenChange={toggleModalOpen}>
        <DialogTrigger asChild>
          <Button onClick={toggleModalOpen}>Open Modal</Button>
        </DialogTrigger>
        <GenerateTokenContent
          form={form}
          manager={manager}
          noPermissionsSelected={noPermissionsSelected}
          onSubmit={values => console.log('Submit:', values)}
          selectedScope={selectedScope}
          setSelectedScope={setSelectedScope}
          toggleModalOpen={toggleModalOpen}
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
      <Dialog open={openModal} onOpenChange={toggleModalOpen}>
        <DialogTrigger asChild>
          <Button onClick={toggleModalOpen}>Open Modal</Button>
        </DialogTrigger>
        <CreatedTokenContent
          mutation={{
            fetching: false,
            data: {
              createToken: {
                ok: {
                  selector: {
                    organization: '',
                    project: '',
                    target: '',
                  },
                  createdToken: {
                    id: 'token-id',
                    name: 'Token Name',
                    alias: 'token-alias',
                    date: '2023-07-17',
                    lastUsedAt: null,
                  },
                  secret: 'token-secret',
                },
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
