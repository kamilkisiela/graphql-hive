import { ReactElement, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import * as z from 'zod';
import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { CopyValue, Tag } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/graphql';
import { RegistryAccessScope, UsageAccessScope } from '@/lib/access/common';
import { useRouteSelector } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

const formSchema = z.object({
  name: z
    .string({
      required_error: 'Required',
    })
    .trim()
    .min(2, {
      message: 'At least 2 characters.',
    })
    .max(128, {
      message: 'At most 128 characters.',
    }),
  scopes: z.array(z.string()).min(1, {
    message: 'Select at least one scope.',
  }),
});

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
          ...TokenFields
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

export function CreateAccessTokenModal({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement {
  const router = useRouteSelector();
  const [organizationQuery] = useQuery({
    query: CreateAccessTokenModalQuery,
    variables: {
      organizationId: router.organizationId,
    },
  });

  const organization = organizationQuery.data?.organization?.organization;

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      {organization && isOpen ? (
        <ModalContent
          organization={organization}
          organizationId={router.organizationId}
          projectId={router.projectId}
          targetId={router.targetId}
          toggleModalOpen={toggleModalOpen}
        />
      ) : null}
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

function ModalContent(props: {
  organization: FragmentType<typeof CreateAccessTokenModalContent_OrganizationFragment>;
  organizationId: string;
  projectId: string;
  targetId: string;
  toggleModalOpen: () => void;
}): ReactElement {
  const organization = useFragment(
    CreateAccessTokenModalContent_OrganizationFragment,
    props.organization,
  );
  const [selectedScopes, setSelectedScopes] = useState<TargetAccessScope[]>([]);
  const manager = usePermissionsManager({
    onSuccess() {},
    organization,
    member: organization.me,
    passMemberScopes: false,
  });

  const [mutation, mutate] = useMutation(CreateAccessToken_CreateTokenMutation);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      scopes: [],
    },
    disabled: mutation.fetching,
  });
  const updateScopes = useCallback(
    (scopes: TargetAccessScope[]) => {
      form.setValue('scopes', [...scopes]);
      void form.trigger('scopes');
      setSelectedScopes(scopes);
    },
    [selectedScopes, setSelectedScopes, form],
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await mutate({
        input: {
          organization: props.organizationId,
          project: props.projectId,
          target: props.targetId,
          name: values.name,
          organizationScopes: [],
          projectScopes: [],
          targetScopes: selectedScopes,
        },
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to create token',
          description: result.error.message,
        });
      } else if (result.data?.createToken.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to create token',
          description: result.data.createToken.error.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create token',
        description: String(error),
      });
    }
  }

  return (
    <DialogContent>
      {mutation.data?.createToken.ok ? (
        <>
          <DialogHeader>
            <DialogTitle>Token successfully created!</DialogTitle>
          </DialogHeader>
          <div className="flex grow flex-col gap-5">
            <CopyValue value={mutation.data.createToken.ok.secret} />
            <Tag color="green">
              This is your unique API key and it is non-recoverable. If you lose this key, you will
              need to create a new one.
            </Tag>
          </div>
          <DialogFooter>
            <Button className="ml-auto" onClick={props.toggleModalOpen}>
              Ok, got it!
            </Button>
          </DialogFooter>
        </>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create an access token</DialogTitle>
              <DialogDescription>
                To access GraphQL Hive, your application or tool needs an active API key.
              </DialogDescription>
            </DialogHeader>
            <div className="flex grow flex-col gap-5 py-4">
              <div className="shrink-0">
                <div className="flex-none">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormDescription>
                          Give token a name so you can easily recognize it later.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div>
                <PermissionsSpace
                  scopes={[RegistryAccessScope, UsageAccessScope]}
                  initialScopes={[]}
                  selectedScopes={selectedScopes}
                  onChange={updateScopes}
                  checkAccess={manager.canAccessTarget}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={props.toggleModalOpen}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !form.formState.isValid || form.formState.isSubmitting || form.formState.disabled
                }
              >
                Generate Token
              </Button>
            </DialogFooter>
          </form>
        </Form>
      )}
    </DialogContent>
  );
}
