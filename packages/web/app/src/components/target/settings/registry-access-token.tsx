import { useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { AnyVariables, useMutation, UseMutationState, useQuery } from 'urql';
import { z } from 'zod';
import { Tag } from '@/components//v2/tag';
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
import { Accordion } from '@/components/v2/accordion';
import { CopyValue } from '@/components/v2/copy-value';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { RegistryAccessScope } from '@/lib/access/common';
import { zodResolver } from '@hookform/resolvers/zod';

export const CreateAccessToken_CreateTokenMutation = graphql(`
  mutation CreateAccessToken_CreateToken($input: CreateTokenInput!) {
    createToken(input: $input) {
      ok {
        selector {
          organizationSlug
          projectSlug
          targetSlug
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
  query CreateAccessTokenModalQuery($organizationSlug: String!) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        ...CreateAccessTokenModalContent_OrganizationFragment
      }
    }
  }
`);

export function CreateAccessTokenModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const { isOpen, toggleModalOpen } = props;
  const [organizationQuery] = useQuery({
    query: CreateAccessTokenModalQuery,
    variables: {
      organizationSlug: props.organizationSlug,
    },
  });

  const organization = organizationQuery.data?.organization?.organization;

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      {organization ? (
        <ModalContent
          organization={organization}
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
          toggleModalOpen={toggleModalOpen}
        />
      ) : (
        <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
          <DialogHeader>
            <DialogTitle>Organization not found</DialogTitle>
            <DialogDescription>
              The organization you are trying to access does not exist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={toggleModalOpen}>Ok, got it!</Button>
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

const createRegistryTokenFormSchema = z.object({
  tokenDescription: z
    .string({
      required_error: 'Token description is required',
    })
    .min(2, {
      message: 'Token description must be at least 2 characters long',
    })
    .max(50, {
      message: 'Token description must be at most 50 characters long',
    })
    .regex(
      /^([a-z]|[0-9]|\s|\.|,|_|-|\/|&)+$/i,
      'Token description restricted to alphanumerical characters, spaces and . , _ - / &',
    ),
});

export function ModalContent(props: {
  organization: FragmentType<typeof CreateAccessTokenModalContent_OrganizationFragment>;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  toggleModalOpen: () => void;
}) {
  const { toast } = useToast();
  const organization = useFragment(
    CreateAccessTokenModalContent_OrganizationFragment,
    props.organization,
  );
  const [selectedScope, setSelectedScope] = useState<'no-access' | TargetAccessScope>('no-access');

  const manager = usePermissionsManager({
    onSuccess() {},
    organization,
    member: organization.me,
    passMemberScopes: false,
  });

  const form = useForm<z.infer<typeof createRegistryTokenFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(createRegistryTokenFormSchema),
    defaultValues: {
      tokenDescription: '',
    },
  });

  const [mutation, mutate] = useMutation(CreateAccessToken_CreateTokenMutation);

  async function onSubmit(values: z.infer<typeof createRegistryTokenFormSchema>) {
    const { error } = await mutate({
      input: {
        organizationSlug: props.organizationSlug,
        projectSlug: props.projectSlug,
        targetSlug: props.targetSlug,
        name: values.tokenDescription,
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
      selectedScope={selectedScope} // Ensure selectedScope is passed correctly
      setSelectedScope={setSelectedScope}
      toggleModalOpen={props.toggleModalOpen}
    />
  );
}

export function CreatedTokenContent(props: {
  mutation: UseMutationState<any, AnyVariables>;
  toggleModalOpen: () => void;
}) {
  return (
    <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
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
      <DialogFooter>
        <Button onClick={props.toggleModalOpen}>Ok, got it!</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function GenerateTokenContent(props: {
  form: UseFormReturn<z.infer<typeof createRegistryTokenFormSchema>>;
  onSubmit: (values: z.infer<typeof createRegistryTokenFormSchema>) => void;
  manager: ReturnType<typeof usePermissionsManager>;
  setSelectedScope: (scope: 'no-access' | TargetAccessScope) => void;
  selectedScope: 'no-access' | TargetAccessScope;
  toggleModalOpen: () => void;
  noPermissionsSelected: boolean;
}) {
  return (
    <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
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
            name="tokenDescription"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="Token description" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Accordion defaultValue="Permissions">
              <Accordion.Item value="Permissions">
                <Accordion.Header>Registry & Usage</Accordion.Header>
                <Accordion.Content>
                  <PermissionScopeItem
                    key={props.selectedScope}
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
                    selectedScope={props.selectedScope} // Ensure selectedScope is passed correctly
                  />
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={ev => {
                ev.preventDefault();
                props.toggleModalOpen();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!props.form.formState.isValid || props.noPermissionsSelected}
            >
              Generate Token
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
