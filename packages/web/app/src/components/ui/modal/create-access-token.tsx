import { ReactElement, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { AnyVariables, useMutation, UseMutationState, useQuery } from 'urql';
import { z } from 'zod';
import { PermissionScopeItem, usePermissionsManager } from '@/components/organization/Permissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Accordion } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { RegistryAccessScope } from '@/lib/access/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { CopyValue } from '../copy-value';
import { Tag } from '../tag';

export const CreateAccessToken_CreateTokenMutation = graphql(`
  mutation CreateAccessToken_CreateToken($input: CreateTokenInput!) {
    createToken(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        createdToken {
          id
          name
          alias
          date
          lastUsedAt
        }
        secret
      }
      error {
        message
      }
    }
  }
`);

const CreateAccessTokenModalQuery = graphql(`
  query CreateAccessTokenModalQuery($organizationId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...CreateAccessTokenModalContent_OrganizationFragment
      }
    }
  }
`);

export function CreateAccessTokenModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  projectId: string;
  targetId: string;
}): ReactElement {
  const { isOpen, toggleModalOpen } = props;
  const [organizationQuery] = useQuery({
    query: CreateAccessTokenModalQuery,
    variables: {
      organizationId: props.organizationId,
    },
  });

  const organization = organizationQuery.data?.organization?.organization;

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      {organization ? (
        <ModalContent
          organization={organization}
          organizationId={props.organizationId}
          projectId={props.projectId}
          targetId={props.targetId}
          toggleModalOpen={toggleModalOpen}
        />
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organization not found</DialogTitle>
            <DialogDescription>
              The organization you are trying to access does not exist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="primary" size="lg" className="ml-auto" onClick={toggleModalOpen}>
              Ok, got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

const CreateAccessTokenModalContent_OrganizationFragment = graphql(`
  fragment CreateAccessTokenModalContent_OrganizationFragment on Organization {
    id
    ...UsePermissionManager_OrganizationFragment
    me {
      ...UsePermissionManager_MemberFragment
    }
  }
`);

function getFinalTargetAccessScopes(
  selectedScope: 'no-access' | TargetAccessScope,
): Array<TargetAccessScope> {
  if (selectedScope === 'no-access') {
    return [];
  }
  if (selectedScope === TargetAccessScope.RegistryWrite) {
    return [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite];
  }
  return [TargetAccessScope.RegistryRead];
}

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Token description is required',
  }),
});

export function ModalContent(props: {
  organization: FragmentType<typeof CreateAccessTokenModalContent_OrganizationFragment>;
  organizationId: string;
  projectId: string;
  targetId: string;
  toggleModalOpen: () => void;
}): ReactElement {
  const { toast } = useToast();
  const organization = useFragment(
    CreateAccessTokenModalContent_OrganizationFragment,
    props.organization,
  );
  const [selectedScope, setSelectedScope] = useState(
    'no-access' as TargetAccessScope | 'no-access',
  );

  const manager = usePermissionsManager({
    onSuccess() {},
    organization,
    member: organization.me,
    passMemberScopes: false,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  const [mutation, mutate] = useMutation(CreateAccessToken_CreateTokenMutation);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { error } = await mutate({
      input: {
        organization: props.organizationId,
        project: props.projectId,
        target: props.targetId,
        name: values.name,
        organizationScopes: [],
        projectScopes: [],
        targetScopes: getFinalTargetAccessScopes(selectedScope),
      },
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create token',
        description: error.message,
      });
    } else {
      toast({
        title: 'Token created',
        description: 'The token has been successfully created.',
      });
    }
  }

  const noPermissionsSelected = selectedScope === 'no-access';
  if (mutation.data?.createToken.ok) {
    return <CreatedTokenContent mutation={mutation} toggleModalOpen={props.toggleModalOpen} />;
  }

  return (
    <GenerateTokenContent
      form={form}
      manager={manager}
      noPermissionsSelected={noPermissionsSelected}
      onSubmit={onSubmit}
      selectedScope="no-access"
      setSelectedScope={setSelectedScope}
      toggleModalOpen={props.toggleModalOpen}
    />
  );
}

export const CreatedTokenContent = (props: {
  mutation: UseMutationState<any, AnyVariables>;
  toggleModalOpen: () => void;
}): ReactElement => {
  return (
    <DialogContent>
      <DialogHeader className="flex flex-col gap-5">
        <DialogTitle>Token successfully created!</DialogTitle>
        <DialogDescription className="flex flex-col gap-5">
          <CopyValue value={props.mutation.data.createToken.ok.secret} />
          <Tag color="green">
            This is your unique API key and it is non-recoverable. If you lose this key, you will
            need to create a new one.
          </Tag>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="sm:justify-start">
        <Button variant="primary" size="lg" className="ml-auto" onClick={props.toggleModalOpen}>
          Ok, got it!
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export const GenerateTokenContent = (props: {
  form: UseFormReturn<z.infer<typeof formSchema>>;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  manager: ReturnType<typeof usePermissionsManager>;
  setSelectedScope: (scope: 'no-access' | TargetAccessScope) => void;
  selectedScope: 'no-access' | TargetAccessScope;
  toggleModalOpen: () => void;
  noPermissionsSelected: boolean;
}): ReactElement => {
  return (
    <DialogContent>
      <Form {...props.form}>
        <form
          className="flex grow flex-col gap-5"
          onSubmit={props.form.handleSubmit(props.onSubmit)}
        >
          <DialogHeader>
            <DialogTitle>Create an access token</DialogTitle>
            <DialogDescription>
              To access GraphQL Hive, your application or tool needs an active API key.
            </DialogDescription>
          </DialogHeader>
          <FormField
            control={props.form.control}
            name="name"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Token description" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Accordion defaultValue="Permissions">
              <Accordion.Item value="Permissions">
                <Accordion.Header>Registry & Usage</Accordion.Header>
                <Accordion.Content>
                  <PermissionScopeItem
                    scope={RegistryAccessScope}
                    canManageScope={
                      props.manager.canAccessTarget(RegistryAccessScope.mapping['read-only']) ||
                      props.manager.canAccessTarget(RegistryAccessScope.mapping['read-write'])
                    }
                    checkAccess={props.manager.canAccessTarget}
                    onChange={value => {
                      if (value === 'no-access') {
                        props.setSelectedScope('no-access');
                        return;
                      }
                      props.setSelectedScope(value);
                    }}
                    possibleScope={Object.values(RegistryAccessScope.mapping)}
                    initialScope={props.selectedScope}
                    selectedScope={props.selectedScope}
                  />
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="lg"
              className="w-full justify-center"
              onClick={props.toggleModalOpen}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full justify-center"
              variant="primary"
              disabled={props.form.formState.isSubmitting || props.noPermissionsSelected}
            >
              Generate Token
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};
