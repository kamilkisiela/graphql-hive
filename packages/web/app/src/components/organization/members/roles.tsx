import { useCallback, useState } from 'react';
import { LockIcon, MoreHorizontalIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'urql';
import { z } from 'zod';
import { PermissionsSpace } from '@/components/organization/Permissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@/gql/graphql';
import { scopes } from '@/lib/access/common';
import { zodResolver } from '@hookform/resolvers/zod';

export const roleFormSchema = z.object({
  name: z
    .string({
      required_error: 'Required',
    })
    .trim()
    .min(2, 'Too short')
    .max(64, 'Max 64 characters long')
    .refine(
      val => typeof val === 'string' && val.length > 0 && val[0] === val[0].toUpperCase(),
      'Must start with a capital letter',
    )
    .refine(val => val !== 'Viewer' && val !== 'Admin', 'Viewer and Admin are reserved'),
  description: z
    .string({
      required_error: 'Please enter role description',
    })
    .trim()
    .min(2, 'Too short')
    .max(256, 'Description is too long'),
  organizationScopes: z.array(z.string()),
  projectScopes: z.array(z.string()),
  targetScopes: z.array(z.string()),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

function canAccessScope<T>(scope: T, currentUserScopes: readonly T[]) {
  return currentUserScopes.includes(scope);
}

const OrganizationMemberRoleEditor_UpdateMemberRoleMutation = graphql(`
  mutation OrganizationMemberRoleEditor_UpdateMemberRoleMutation($input: UpdateMemberRoleInput!) {
    updateMemberRole(input: $input) {
      ok {
        updatedRole {
          id
          ...OrganizationMemberRoleRow_MemberRoleFragment
        }
      }
      error {
        message
        inputErrors {
          name
          description
        }
      }
    }
  }
`);

const OrganizationMemberRoleEditor_MeFragment = graphql(`
  fragment OrganizationMemberRoleEditor_MeFragment on Member {
    id
    isAdmin
    organizationAccessScopes
    projectAccessScopes
    targetAccessScopes
  }
`);

function OrganizationMemberRoleEditor(props: {
  mode?: 'edit' | 'read-only';
  close(): void;
  organizationCleanId: string;
  me: FragmentType<typeof OrganizationMemberRoleEditor_MeFragment>;
  role: FragmentType<typeof OrganizationMemberRoleRow_MemberRoleFragment>;
}) {
  const me = useFragment(OrganizationMemberRoleEditor_MeFragment, props.me);
  const role = useFragment(OrganizationMemberRoleRow_MemberRoleFragment, props.role);
  const [updateMemberRoleState, updateMemberRole] = useMutation(
    OrganizationMemberRoleEditor_UpdateMemberRoleMutation,
  );
  const { toast } = useToast();
  const isDisabled = props.mode === 'read-only' || updateMemberRoleState.fetching;
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: role.name,
      description: role.description,
      organizationScopes: [...role.organizationAccessScopes],
      projectScopes: [...role.projectAccessScopes],
      targetScopes: [...role.targetAccessScopes],
    },
    disabled: isDisabled,
  });

  const initialScopes = {
    organization: [...role.organizationAccessScopes],
    project: [...role.projectAccessScopes],
    target: [...role.targetAccessScopes],
  };

  const [targetScopes, setTargetScopes] = useState<TargetAccessScope[]>([
    ...role.targetAccessScopes,
  ]);
  const [projectScopes, setProjectScopes] = useState<ProjectAccessScope[]>([
    ...role.projectAccessScopes,
  ]);
  const [organizationScopes, setOrganizationScopes] = useState<OrganizationAccessScope[]>([
    ...role.organizationAccessScopes,
  ]);

  const updateTargetScopes = useCallback(
    (scopes: TargetAccessScope[]) => {
      setTargetScopes(scopes);
      form.setValue('targetScopes', [...scopes]);
    },
    [targetScopes],
  );

  const updateProjectScopes = useCallback(
    (scopes: ProjectAccessScope[]) => {
      setProjectScopes(scopes);
      form.setValue('projectScopes', [...scopes]);
    },
    [projectScopes],
  );

  const updateOrganizationScopes = useCallback(
    (scopes: OrganizationAccessScope[]) => {
      setOrganizationScopes(scopes);
      form.setValue('organizationScopes', [...scopes]);
    },
    [organizationScopes],
  );

  async function onSubmit(data: RoleFormValues) {
    try {
      const result = await updateMemberRole({
        input: {
          organization: props.organizationCleanId,
          role: role.id,
          name: data.name,
          description: data.description,
          organizationAccessScopes: data.organizationScopes.filter(scope =>
            Object.values(OrganizationAccessScope).includes(scope as OrganizationAccessScope),
          ) as OrganizationAccessScope[],
          projectAccessScopes: data.projectScopes.filter(scope =>
            Object.values(ProjectAccessScope).includes(scope as ProjectAccessScope),
          ) as ProjectAccessScope[],
          targetAccessScopes: data.targetScopes.filter(scope =>
            Object.values(TargetAccessScope).includes(scope as TargetAccessScope),
          ) as TargetAccessScope[],
        },
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to update the member role',
          description: result.error.message,
        });
      } else if (result.data?.updateMemberRole.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to update member role',
          description: result.data.updateMemberRole.error.message,
        });
        if (result.data.updateMemberRole.error.inputErrors?.name) {
          form.setError('name', {
            message: result.data.updateMemberRole.error.inputErrors.name,
          });
        }
        if (result.data.updateMemberRole.error.inputErrors?.description) {
          form.setError('description', {
            message: result.data.updateMemberRole.error.inputErrors.description,
          });
        }
      } else if (result.data?.updateMemberRole.ok) {
        toast({
          title: 'Member role updated',
        });
        props.close();
      }
    } catch (err) {
      console.log('Failed to update the member role');
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Failed to update the member role',
        description: String(err),
      });
    }
  }

  const hasMembers = role.membersCount > 0;
  const { isAdmin } = me;
  const noDowngrade = hasMembers && !isAdmin;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogContent className="max-w-[960px]">
          <DialogHeader>
            <DialogTitle>Member Role{props.mode === 'read-only' ? '' : ' Editor'}</DialogTitle>
            <DialogDescription>
              {isAdmin ? (
                'As an admin, you can add or remove permissions from the role.'
              ) : hasMembers ? (
                <>
                  This role is assigned to at least one member.
                  <br />
                  You can only add permissions to the role,{' '}
                  <span className="font-bold">you cannot downgrade its members.</span>
                </>
              ) : (
                'You can add or remove permissions from the role as it has no members.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row space-x-6">
            <div className="w-72 shrink-0 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a name" type="text" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter a description" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grow">
              <div className="space-y-2">
                <FormLabel>Permissions</FormLabel>
                <Tabs defaultValue="Organization" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="Organization">Organization</TabsTrigger>
                    <TabsTrigger value="Projects">Projects</TabsTrigger>
                    <TabsTrigger value="Targets">Targets</TabsTrigger>
                  </TabsList>
                  <PermissionsSpace
                    disabled={isDisabled}
                    title="Organization"
                    scopes={scopes.organization}
                    initialScopes={initialScopes.organization}
                    selectedScopes={organizationScopes}
                    onChange={updateOrganizationScopes}
                    checkAccess={scope => canAccessScope(scope, me.organizationAccessScopes)}
                    noDowngrade={noDowngrade}
                  />
                  <PermissionsSpace
                    disabled={isDisabled}
                    title="Projects"
                    scopes={scopes.project}
                    initialScopes={initialScopes.project}
                    selectedScopes={projectScopes}
                    onChange={updateProjectScopes}
                    checkAccess={scope => canAccessScope(scope, me.projectAccessScopes)}
                    noDowngrade={noDowngrade}
                  />
                  <PermissionsSpace
                    disabled={isDisabled}
                    title="Targets"
                    scopes={scopes.target}
                    initialScopes={initialScopes.target}
                    selectedScopes={targetScopes}
                    onChange={updateTargetScopes}
                    checkAccess={scope => canAccessScope(scope, me.targetAccessScopes)}
                    noDowngrade={noDowngrade}
                  />
                </Tabs>
              </div>
            </div>
          </div>
          {props.mode === 'read-only' ? null : (
            <DialogFooter>
              <Button variant="ghost" onClick={props.close}>
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit)}
                disabled={
                  !form.formState.isValid || form.formState.isSubmitting || form.formState.disabled
                }
              >
                {form.formState.isSubmitting
                  ? 'Creating...'
                  : targetScopes.length + projectScopes.length + organizationScopes.length === 0
                    ? 'Submit a read-only role'
                    : 'Submit'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </form>
    </Form>
  );
}

const OrganizationMemberRoleCreator_CreateMemberRoleMutation = graphql(`
  mutation OrganizationMemberRoleCreator_CreateMemberRoleMutation($input: CreateMemberRoleInput!) {
    createMemberRole(input: $input) {
      ok {
        updatedOrganization {
          id
          memberRoles {
            id
            ...OrganizationMemberRoleRow_MemberRoleFragment
          }
        }
      }
      error {
        message
        inputErrors {
          name
          description
        }
      }
    }
  }
`);

const OrganizationMemberRoleCreator_MeFragment = graphql(`
  fragment OrganizationMemberRoleCreator_MeFragment on Member {
    id
    organizationAccessScopes
    projectAccessScopes
    targetAccessScopes
  }
`);

function OrganizationMemberRoleCreator(props: {
  close(): void;
  organizationCleanId: string;
  me: FragmentType<typeof OrganizationMemberRoleCreator_MeFragment>;
}) {
  const me = useFragment(OrganizationMemberRoleCreator_MeFragment, props.me);
  const [createMemberRoleState, createMemberRole] = useMutation(
    OrganizationMemberRoleCreator_CreateMemberRoleMutation,
  );
  const { toast } = useToast();
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [],
    },
    disabled: createMemberRoleState.fetching,
  });

  const [targetScopes, setTargetScopes] = useState<TargetAccessScope[]>([]);
  const [projectScopes, setProjectScopes] = useState<ProjectAccessScope[]>([]);
  const [organizationScopes, setOrganizationScopes] = useState<OrganizationAccessScope[]>([]);

  const updateTargetScopes = useCallback(
    (scopes: TargetAccessScope[]) => {
      setTargetScopes(scopes);
      form.setValue('targetScopes', [...scopes]);
    },
    [targetScopes],
  );

  const updateProjectScopes = useCallback(
    (scopes: ProjectAccessScope[]) => {
      setProjectScopes(scopes);
      form.setValue('projectScopes', [...scopes]);
    },
    [projectScopes],
  );

  const updateOrganizationScopes = useCallback(
    (scopes: OrganizationAccessScope[]) => {
      setOrganizationScopes(scopes);
      form.setValue('organizationScopes', [...scopes]);
    },
    [organizationScopes],
  );

  async function onSubmit(data: RoleFormValues) {
    try {
      const result = await createMemberRole({
        input: {
          organization: props.organizationCleanId,
          name: data.name,
          description: data.description,
          organizationAccessScopes: data.organizationScopes.filter(scope =>
            Object.values(OrganizationAccessScope).includes(scope as OrganizationAccessScope),
          ) as OrganizationAccessScope[],
          projectAccessScopes: data.projectScopes.filter(scope =>
            Object.values(ProjectAccessScope).includes(scope as ProjectAccessScope),
          ) as ProjectAccessScope[],
          targetAccessScopes: data.targetScopes.filter(scope =>
            Object.values(TargetAccessScope).includes(scope as TargetAccessScope),
          ) as TargetAccessScope[],
        },
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to create member role',
          description: result.error.message,
        });
      } else if (result.data?.createMemberRole.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to create member role',
          description: result.data.createMemberRole.error.message,
        });
        if (result.data.createMemberRole.error.inputErrors?.name) {
          form.setError('name', {
            message: result.data.createMemberRole.error.inputErrors.name,
          });
        }
        if (result.data.createMemberRole.error.inputErrors?.description) {
          form.setError('description', {
            message: result.data.createMemberRole.error.inputErrors.description,
          });
        }
      } else if (result.data?.createMemberRole.ok) {
        toast({
          title: 'Member role created',
        });
        props.close();
      }
    } catch (err) {
      console.log('Failed to create member role');
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Failed to create member role',
        description: String(err),
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogContent className="max-w-[960px]">
          <DialogHeader>
            <DialogTitle>Member Role Creator</DialogTitle>
            <DialogDescription>
              Create a new role that can be assigned to members of this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row space-x-6">
            <div className="w-72 shrink-0 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a name" type="text" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea autoComplete="off" placeholder="Enter a description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grow">
              <div className="space-y-2">
                <FormLabel>Permissions</FormLabel>
                <Tabs defaultValue="Organization" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="Organization">Organization</TabsTrigger>
                    <TabsTrigger value="Projects">Projects</TabsTrigger>
                    <TabsTrigger value="Targets">Targets</TabsTrigger>
                  </TabsList>
                  <PermissionsSpace
                    title="Organization"
                    scopes={scopes.organization}
                    initialScopes={[]}
                    selectedScopes={organizationScopes}
                    onChange={updateOrganizationScopes}
                    checkAccess={scope => canAccessScope(scope, me.organizationAccessScopes)}
                  />
                  <PermissionsSpace
                    title="Projects"
                    scopes={scopes.project}
                    initialScopes={[]}
                    selectedScopes={projectScopes}
                    onChange={updateProjectScopes}
                    checkAccess={scope => canAccessScope(scope, me.projectAccessScopes)}
                  />
                  <PermissionsSpace
                    title="Targets"
                    scopes={scopes.target}
                    initialScopes={[]}
                    selectedScopes={targetScopes}
                    onChange={updateTargetScopes}
                    checkAccess={scope => canAccessScope(scope, me.targetAccessScopes)}
                  />
                </Tabs>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={props.close}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={
                !form.formState.isValid || form.formState.isSubmitting || form.formState.disabled
              }
            >
              {form.formState.isSubmitting
                ? 'Creating...'
                : targetScopes.length + projectScopes.length + organizationScopes.length === 0
                  ? 'Submit a read-only role'
                  : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Form>
  );
}

function OrganizationMemberRoleCreateButton(props: {
  organizationCleanId: string;
  me: FragmentType<typeof OrganizationMemberRoleCreator_MeFragment>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create a new role</Button>
      </DialogTrigger>
      {open ? (
        <OrganizationMemberRoleCreator
          organizationCleanId={props.organizationCleanId}
          me={props.me}
          close={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}

const OrganizationMemberRoleRow_MemberRoleFragment = graphql(`
  fragment OrganizationMemberRoleRow_MemberRoleFragment on MemberRole {
    id
    name
    description
    locked
    organizationAccessScopes
    projectAccessScopes
    targetAccessScopes
    canDelete
    canUpdate
    membersCount
  }
`);

function OrganizationMemberRoleRow(props: {
  role: FragmentType<typeof OrganizationMemberRoleRow_MemberRoleFragment>;
  onEdit(role: FragmentType<typeof OrganizationMemberRoleRow_MemberRoleFragment>): void;
  onDelete(role: FragmentType<typeof OrganizationMemberRoleRow_MemberRoleFragment>): void;
  onShow(role: FragmentType<typeof OrganizationMemberRoleRow_MemberRoleFragment>): void;
}) {
  const role = useFragment(OrganizationMemberRoleRow_MemberRoleFragment, props.role);
  return (
    <tr>
      <td className="py-3 text-sm font-medium">
        <div className="flex flex-row items-center ">
          <div>{role.name}</div>
          {role.locked ? (
            <div className="ml-2">
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <LockIcon className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-col items-start gap-y-2 p-2">
                      <div className="font-medium">This role is locked</div>
                      <div className="text-sm text-gray-400">
                        Locked roles are created by the system and cannot be modified or deleted.
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null}
        </div>
      </td>
      <td className="break-words py-3 text-sm text-gray-400" title={role.description}>
        {role.description}
      </td>
      <td className="py-3 text-center text-sm">
        {role.membersCount} {role.membersCount === 1 ? 'member' : 'members'}
      </td>
      <td className="py-3 text-right text-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="data-[state=open]:bg-muted flex h-8 w-8 p-0">
              <MoreHorizontalIcon className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem onClick={() => props.onShow(props.role)}>Show</DropdownMenuItem>
            <TooltipProvider>
              <Tooltip delayDuration={200} {...(role.canUpdate ? { open: false } : {})}>
                <TooltipTrigger className="block w-full">
                  <DropdownMenuItem
                    onClick={() => props.onEdit(props.role)}
                    disabled={!role.canUpdate}
                  >
                    Edit
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent>
                  {role.canUpdate
                    ? null
                    : "You cannot edit this role as you don't have enough permissions."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip delayDuration={200} {...(role.canDelete ? { open: false } : {})}>
                <TooltipTrigger className="block w-full">
                  <DropdownMenuItem
                    onClick={() => props.onDelete(props.role)}
                    disabled={!role.canDelete}
                  >
                    Delete
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent>
                  {role.canDelete
                    ? null
                    : `You cannot delete this role as ${
                        role.membersCount > 0
                          ? 'it has members.'
                          : "you don't have enough permissions."
                      }`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

const OrganizationMemberRoles_DeleteMemberRole = graphql(`
  mutation OrganizationMemberRoles_DeleteMemberRole($input: DeleteMemberRoleInput!) {
    deleteMemberRole(input: $input) {
      ok {
        updatedOrganization {
          id
          memberRoles {
            id
            name
            ...OrganizationMemberRoleRow_MemberRoleFragment
          }
          invitations {
            nodes {
              id
              role {
                id
              }
            }
          }
        }
      }
      error {
        message
      }
    }
  }
`);

const OrganizationMemberRoles_OrganizationFragment = graphql(`
  fragment OrganizationMemberRoles_OrganizationFragment on Organization {
    id
    cleanId
    memberRoles {
      id
      name
      ...OrganizationMemberRoleRow_MemberRoleFragment
    }
    me {
      id
      ...OrganizationMemberRoleCreator_MeFragment
      ...OrganizationMemberRoleEditor_MeFragment
    }
  }
`);

export function OrganizationMemberRoles(props: {
  organization: FragmentType<typeof OrganizationMemberRoles_OrganizationFragment>;
}) {
  const { toast } = useToast();
  const organization = useFragment(
    OrganizationMemberRoles_OrganizationFragment,
    props.organization,
  );

  const [deleteRoleState, deleteRole] = useMutation(OrganizationMemberRoles_DeleteMemberRole);
  const [roleToEdit, setRoleToEdit] = useState<(typeof organization.memberRoles)[number] | null>(
    null,
  );
  const [roleToShow, setRoleToShow] = useState<(typeof organization.memberRoles)[number] | null>(
    null,
  );
  const [roleToDelete, setRoleToDelete] = useState<
    (typeof organization.memberRoles)[number] | null
  >(null);

  return (
    <>
      <Dialog
        open={!!roleToEdit}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setRoleToEdit(null);
          }
        }}
      >
        {roleToEdit ? (
          <OrganizationMemberRoleEditor
            organizationCleanId={organization.cleanId}
            me={organization.me}
            role={roleToEdit}
            close={() => setRoleToEdit(null)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={!!roleToShow}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setRoleToShow(null);
          }
        }}
      >
        {roleToShow ? (
          <OrganizationMemberRoleEditor
            mode="read-only"
            organizationCleanId={organization.cleanId}
            me={organization.me}
            role={roleToShow}
            close={() => setRoleToShow(null)}
          />
        ) : null}
      </Dialog>
      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setRoleToDelete(null);
          }
        }}
      >
        {roleToDelete ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete{' '}
                <strong>{roleToDelete.name}</strong> from the organization.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteRoleState.fetching}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteRoleState.fetching}
                onClick={async event => {
                  event.preventDefault();

                  try {
                    const result = await deleteRole({
                      input: {
                        organization: organization.cleanId,
                        role: roleToDelete.id,
                      },
                    });

                    if (result.error) {
                      toast({
                        variant: 'destructive',
                        title: 'Failed to delete a role',
                        description: result.error.message,
                      });
                    } else {
                      toast({
                        title: 'Role deleted',
                      });
                      setRoleToDelete(null);
                    }
                  } catch (error) {
                    console.log('Failed to delete a role');
                    console.error(error);
                    toast({
                      variant: 'destructive',
                      title: 'Failed to delete a role',
                      description: String(error),
                    });
                  }
                }}
              >
                {deleteRoleState.fetching ? 'Deleting...' : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
      <div className="space-y-6">
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-2">
            <CardTitle>List of roles</CardTitle>
            <CardDescription>
              Manage the roles that can be assigned to members of this organization.
            </CardDescription>
          </div>
          <div>
            <OrganizationMemberRoleCreateButton
              me={organization.me}
              organizationCleanId={organization.cleanId}
            />
          </div>
        </div>
        <table className="w-full table-auto divide-y-[1px] divide-gray-500/20">
          <thead>
            <tr>
              <th className="min-w-[200px] py-3 text-left text-sm font-semibold">Name</th>
              <th className="py-3 text-left text-sm font-semibold">Description</th>
              <th className="min-w-[150px] py-3 text-center text-sm font-semibold">Members</th>
              <th className="w-12 py-3 text-right text-sm font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y-[1px] divide-gray-500/20">
            {organization.memberRoles.map(role => (
              <OrganizationMemberRoleRow
                key={role.id}
                role={role}
                onEdit={() => setRoleToEdit(role)}
                onDelete={() => setRoleToDelete(role)}
                onShow={() => setRoleToShow(role)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
