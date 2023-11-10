import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { differenceInCalendarDays } from 'date-fns';
import { InfoIcon, LightbulbIcon, PartyPopperIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'urql';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@/gql/graphql';
import { Scope, scopes } from '@/lib/access/common';
import { zodResolver } from '@hookform/resolvers/zod';
import { PermissionsSpace } from '../Permissions';
import { RoleSelector } from './common';
import { authProviderToIconAndTextMap } from './list';
import { roleFormSchema } from './roles';

const MemberRoleMigrationStickyNote_OrganizationFragment = graphql(`
  fragment MemberRoleMigrationStickyNote_OrganizationFragment on Organization {
    id
    cleanId
    me {
      isAdmin
    }
    unassignedMembersToMigrate {
      id
    }
  }
`);
export function MemberRoleMigrationStickyNote(props: {
  organization?: FragmentType<typeof MemberRoleMigrationStickyNote_OrganizationFragment> | null;
}) {
  const router = useRouter();
  const organization = useFragment(
    MemberRoleMigrationStickyNote_OrganizationFragment,
    props.organization,
  );

  const isAdmin = organization?.me.isAdmin;
  const unassignedMembersToMigrateCount = organization?.unassignedMembersToMigrate.length;
  const migrationDeadline = __frontend_env.migrations.member_roles_deadline;
  const daysLeft = useRef<number>();

  if (typeof daysLeft.current !== 'number') {
    daysLeft.current = migrationDeadline
      ? differenceInCalendarDays(new Date(migrationDeadline), new Date())
      : 0;
  }

  const isMembersView = router.route.startsWith('/[organizationId]/view/members');

  if (
    // Only admins can perform migration
    !isAdmin ||
    // No unassigned members to migrate
    unassignedMembersToMigrateCount === 0 ||
    // Migration deadline is not set
    !migrationDeadline ||
    // Migration deadline has passed
    daysLeft.current <= 0 ||
    // Component is rendered on the members page
    isMembersView
  ) {
    return null;
  }

  return (
    <div className="flex flex-row items-center gap-x-2 rounded-md bg-orange-900/40 px-3 py-2">
      <InfoIcon className="h-4 w-4" />
      <span className="text-sm">
        {daysLeft.current} {daysLeft.current > 1 ? 'days' : 'day'} left to{' '}
        <Link
          className="underline underline-offset-4"
          href={{
            pathname: '/[organizationId]/view/members',
            query: {
              organizationId: organization.cleanId,
              page: 'migration',
            },
          }}
        >
          assign roles
        </Link>{' '}
        to all members
      </span>
    </div>
  );
}

function SimilarRoleScopes<T>(props: {
  prefix: string;
  definitions: readonly Scope<T>[];
  scopes: readonly T[];
}) {
  if (props.scopes.length === 0) {
    return null;
  }

  const groupedScopes = useRef<
    {
      name: string;
      description: string;
      readOnly: boolean;
      readWrite: boolean;
      hasBothOptions: boolean;
    }[]
  >();

  if (!groupedScopes.current) {
    groupedScopes.current = [];
    for (const def of props.definitions) {
      const readOnly = def.mapping['read-only']
        ? props.scopes.includes(def.mapping['read-only'])
        : false;
      const readWrite = props.scopes.includes(def.mapping['read-write']);

      if (readOnly || readWrite) {
        groupedScopes.current.push({
          name: def.name,
          description: def.description,
          readOnly,
          readWrite,
          hasBothOptions: !!def.mapping['read-only'],
        });
      }
    }
  }

  return (
    <>
      {groupedScopes.current?.map(scope => {
        return (
          <div key={scope.name} className="flex flex-row items-center justify-between gap-x-4 pt-2">
            <div>
              <p className="text-xs font-semibold">
                {props.prefix} - {scope.name}
              </p>
              <p className="text-xs text-gray-500">{scope.description}</p>
            </div>
            <div className="text-xs">
              {scope.hasBothOptions ? (
                <>
                  {scope.readOnly && !scope.readWrite ? <div>Read</div> : null}
                  {scope.readWrite && !scope.readOnly ? <div>Write</div> : null}
                  {scope.readOnly && scope.readWrite ? <div>All access</div> : null}
                </>
              ) : scope.readWrite ? (
                <div>All access</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

function SimilarRoles(props: {
  memberGroupOrganizationScopes: readonly OrganizationAccessScope[];
  memberGroupProjectScopes: readonly ProjectAccessScope[];
  memberGroupTargetScopes: readonly TargetAccessScope[];
  roles: readonly {
    id: string;
    name: string;
    description: string;
    organizationAccessScopes: readonly OrganizationAccessScope[];
    projectAccessScopes: readonly ProjectAccessScope[];
    targetAccessScopes: readonly TargetAccessScope[];
  }[];
}) {
  return (
    <>
      <h4 className="mb-2 text-sm font-medium leading-none">Similar roles</h4>
      <p className="text-xs text-gray-400">
        Maybe some of the existing roles are similar to the one you are about to create?
      </p>
      <div className="my-4 h-[1px] w-full bg-gray-900" />
      <div className="space-y-4 text-sm">
        {props.roles.map(role => {
          const downgrade = {
            organization: props.memberGroupOrganizationScopes.filter(
              scope => !role.organizationAccessScopes.includes(scope),
            ),
            project: props.memberGroupProjectScopes.filter(
              scope => !role.projectAccessScopes.includes(scope),
            ),
            target: props.memberGroupTargetScopes.filter(
              scope => !role.targetAccessScopes.includes(scope),
            ),
          };
          const upgrade = {
            organization: role.organizationAccessScopes.filter(
              scope => !props.memberGroupOrganizationScopes.includes(scope),
            ),
            project: role.projectAccessScopes.filter(
              scope => !props.memberGroupProjectScopes.includes(scope),
            ),
            target: role.targetAccessScopes.filter(
              scope => !props.memberGroupTargetScopes.includes(scope),
            ),
          };

          const downgradeCount =
            downgrade.organization.length + downgrade.project.length + downgrade.target.length;
          const upgradeCount =
            upgrade.organization.length + upgrade.project.length + upgrade.target.length;

          return (
            <div key={role.id} className="flex flex-row items-center justify-between">
              <div className="w-auto flex-none">
                <div>{role.name}</div>
                {/* <div className="max-w-[150px] truncate whitespace-nowrap break-words text-xs text-gray-400">
                  {role.description}
                </div> */}
              </div>
              <div className="flex w-[50px] shrink-0 flex-row items-center justify-end gap-x-2">
                {upgradeCount > 0 ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="text-emerald-500">{'+' + upgradeCount}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold">
                          Members would <span className="text-emerald-500">gain</span> the following
                          permissions:
                        </p>
                        <div className="space-y-2 divide-y-[1px] divide-gray-500/20">
                          <SimilarRoleScopes
                            definitions={scopes.organization}
                            scopes={upgrade.organization}
                            prefix="Organization"
                          />
                          <SimilarRoleScopes
                            definitions={scopes.project}
                            scopes={upgrade.project}
                            prefix="Projects"
                          />
                          <SimilarRoleScopes
                            definitions={scopes.target}
                            scopes={upgrade.target}
                            prefix="Targets"
                          />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
                {upgradeCount > 0 && downgradeCount > 0 ? (
                  <div className="text-gray-500">/</div>
                ) : null}
                {downgradeCount > 0 ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="text-red-500">{'-' + downgradeCount}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold">
                          Members would <span className="text-red-500">lose</span> the following
                          permissions:
                        </p>
                        <div className="space-y-2 divide-y-[1px] divide-gray-500/20">
                          <SimilarRoleScopes
                            definitions={scopes.organization}
                            scopes={upgrade.organization}
                            prefix="Organization"
                          />
                          <SimilarRoleScopes
                            definitions={scopes.project}
                            scopes={upgrade.project}
                            prefix="Projects"
                          />
                          <SimilarRoleScopes
                            definitions={scopes.target}
                            scopes={upgrade.target}
                            prefix="Targets"
                          />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const migrationFormSchema = z.intersection(
  z.object({
    members: z.array(z.string()).min(1),
  }),
  z.union([
    roleFormSchema,
    z.object({
      roleId: z.string().trim().min(1),
    }),
  ]),
);

type MigrationFormValues = z.infer<typeof migrationFormSchema>;

const OrganizationMemberRolesMigrationGroup_MemberRoleMigrationGroup = graphql(`
  fragment OrganizationMemberRolesMigrationGroup_MemberRoleMigrationGroup on MemberRoleMigrationGroup {
    id
    members {
      id
      user {
        id
        email
        displayName
        provider
      }
    }
    organizationScopes
    projectScopes
    targetScopes
  }
`);

const OrganizationMemberRolesMigrationGroup_Migrate = graphql(`
  mutation OrganizationMemberRolesMigrationGroup_Migrate($input: MigrateUnassignedMembersInput!) {
    migrateUnassignedMembers(input: $input) {
      ok {
        updatedOrganization {
          id
          members {
            nodes {
              id
              organizationAccessScopes
              projectAccessScopes
              targetAccessScopes
              role {
                id
                organizationAccessScopes
                projectAccessScopes
                targetAccessScopes
              }
            }
            total
          }
          memberRoles {
            id
            ...OrganizationMemberRoleRow_MemberRoleFragment
          }
          unassignedMembersToMigrate {
            id
          }
        }
      }
      error {
        message
      }
    }
  }
`);

function OrganizationMemberRolesMigrationGroup(props: {
  organizationCleanId: string;
  memberGroup: FragmentType<typeof OrganizationMemberRolesMigrationGroup_MemberRoleMigrationGroup>;
  roles: readonly {
    id: string;
    name: string;
    description: string;
    organizationAccessScopes: readonly OrganizationAccessScope[];
    projectAccessScopes: readonly ProjectAccessScope[];
    targetAccessScopes: readonly TargetAccessScope[];
  }[];
}) {
  const memberGroup = useFragment(
    OrganizationMemberRolesMigrationGroup_MemberRoleMigrationGroup,
    props.memberGroup,
  );
  const { toast } = useToast();
  const form = useForm<MigrationFormValues>({
    mode: 'onChange',
    resolver: zodResolver(migrationFormSchema),
    defaultValues: {
      members: memberGroup.members.map(m => m.id),
      roleId: '',
      name: '',
      description: '',
      organizationScopes: [...memberGroup.organizationScopes],
      projectScopes: [...memberGroup.projectScopes],
      targetScopes: [...memberGroup.targetScopes],
    },
  });
  const [migrationState, migrate] = useMutation(OrganizationMemberRolesMigrationGroup_Migrate);

  const [customAccessModalOpen, setCustomAccessModalOpen] = useState(false);
  // Represents the scopes that are going to be assigned to the new role.
  const [newRoleScopes, setNewRoleScopes] = useState({
    organization: memberGroup.organizationScopes,
    project: memberGroup.projectScopes,
    target: memberGroup.targetScopes,
  });
  // Represents the scopes that are currently selected in the dialog, but not yet saved.
  const [temporaryScopes, setTemporaryScopes] = useState({
    organization: memberGroup.organizationScopes,
    project: memberGroup.projectScopes,
    target: memberGroup.targetScopes,
  });

  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const saveCustomRoles = useCallback(() => {
    // set temporary scopes as new role scopes
    setNewRoleScopes({ ...temporaryScopes });
  }, [setNewRoleScopes, temporaryScopes]);
  const resetCustomRolesToPreviousSave = useCallback(() => {
    // reset temporary scopes
    setTemporaryScopes({ ...newRoleScopes });
  }, [setTemporaryScopes, newRoleScopes]);

  async function onSubmit(data: MigrationFormValues) {
    try {
      const result = await migrate({
        input:
          'roleId' in data
            ? {
                assignRole: {
                  organization: props.organizationCleanId,
                  role: data.roleId,
                  members: data.members,
                },
              }
            : {
                createRole: {
                  organization: props.organizationCleanId,
                  name: data.name,
                  description: data.description,
                  organizationScopes: data.organizationScopes.filter(
                    (s): s is OrganizationAccessScope =>
                      Object.values(OrganizationAccessScope).includes(s as OrganizationAccessScope),
                  ),
                  projectScopes: data.projectScopes.filter((s): s is ProjectAccessScope =>
                    Object.values(ProjectAccessScope).includes(s as ProjectAccessScope),
                  ),
                  targetScopes: data.targetScopes.filter((s): s is TargetAccessScope =>
                    Object.values(TargetAccessScope).includes(s as TargetAccessScope),
                  ),
                  members: data.members,
                },
              },
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to migrate members',
          description: result.error.message,
        });
      } else if (result.data?.migrateUnassignedMembers.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to migrate members',
          description: result.data.migrateUnassignedMembers.error.message,
        });
      } else {
        toast({
          title: 'Members migrated',
          description:
            'roleId' in data ? 'Members migrated to existing role' : 'Members migrated to new role',
        });
        setConfirmationOpen(false);
      }
    } catch (error) {
      console.log('Failed to migrate members', data);
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to migrate members',
        description: String(error),
      });
    }
  }

  const isRoleSelected = form.watch('roleId').length > 0;

  return (
    <Form {...form}>
      <tr>
        <td className="relative py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Enter a name"
                    type="text"
                    autoComplete="off"
                    {...field}
                    disabled={isRoleSelected || field.disabled}
                    onChange={e => {
                      form.setValue('roleId', '');
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage className="absolute text-xs" />
              </FormItem>
            )}
          />
        </td>
        <td className="relative px-2 py-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    autoComplete="off"
                    className="h-[40px] min-h-0 max-w-[400px]"
                    placeholder="Enter a description"
                    {...field}
                    disabled={isRoleSelected || field.disabled}
                    onChange={e => {
                      form.setValue('roleId', '');
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormMessage className="absolute text-xs" />
              </FormItem>
            )}
          />
        </td>
        <td className="py-4 text-center text-sm">
          <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
              <Button variant="link">
                {memberGroup.members.length}{' '}
                {memberGroup.members.length === 1 ? 'member' : 'members'}
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="p-0">
              <ScrollArea className="h-72 text-left">
                <div className="p-4">
                  <h4 className="mb-4 text-sm font-medium leading-none">Members</h4>
                  <div className="divide-y-[1px] divide-gray-500/20">
                    {memberGroup.members.map(member => {
                      const IconToUse = authProviderToIconAndTextMap[member.user.provider].icon;
                      const authMethod = authProviderToIconAndTextMap[member.user.provider].text;

                      return (
                        <div
                          key={member.id}
                          className="flex flex-row items-center justify-between py-2 text-sm"
                        >
                          <div>{member.user.email}</div>
                          <TooltipProvider>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <div>
                                  <IconToUse className="mx-auto h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                User's authentication method: {authMethod}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </HoverCardContent>
          </HoverCard>
        </td>
        <td className="relative mx-auto flex flex-row items-center justify-center gap-x-2 py-4 text-center text-sm">
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RoleSelector
                    roles={props.roles}
                    defaultRole={props.roles.find(r => r.id === field.value)}
                    isRoleActive={() => true /* Yes, as only admins can perform migration */}
                    onNoRole={() => {
                      form.setValue('roleId', '');
                      field.onChange('');
                      field.onBlur();
                    }}
                    onSelect={role => {
                      form.setValue('description', '');
                      form.setValue('name', '');
                      field.onChange(role.id);
                      field.onBlur();
                    }}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                  />
                </FormControl>
                <FormMessage className="absolute text-xs" />
              </FormItem>
            )}
          />
          {isRoleSelected ? null : <div>/</div>}
          {isRoleSelected ? null : (
            <Dialog
              open={customAccessModalOpen}
              onOpenChange={open => {
                // Reset temporary scopes when dialog is being closed
                if (!open) {
                  resetCustomRolesToPreviousSave();
                }
                setCustomAccessModalOpen(open);
              }}
            >
              <TooltipProvider>
                <Tooltip>
                  <DialogTrigger asChild>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => {
                          setCustomAccessModalOpen(true);
                        }}
                        variant="outline"
                      >
                        Custom
                      </Button>
                    </TooltipTrigger>
                  </DialogTrigger>
                  <TooltipContent>
                    See permissions of the users in this group and modify them if needed.
                    <br />
                    These permissions will be applied to the new role. You can change them later.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DialogContent className="max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Permissions (legacy)</DialogTitle>
                  <DialogDescription>
                    Adjusts the permissions of the users in this group. These permissions will be
                    applied to the new role. You can change them later.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="Organization" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="Organization">Organization</TabsTrigger>
                    <TabsTrigger value="Projects">Projects</TabsTrigger>
                    <TabsTrigger value="Targets">Targets</TabsTrigger>
                  </TabsList>
                  <PermissionsSpace
                    title="Organization"
                    scopes={scopes.organization}
                    initialScopes={temporaryScopes.organization}
                    selectedScopes={temporaryScopes.organization}
                    onChange={scopes => {
                      setTemporaryScopes(prev => ({
                        ...prev,
                        organization: scopes,
                      }));
                    }}
                    checkAccess={() => true /* Yes, as only admins can perform migration */}
                  />
                  <PermissionsSpace
                    title="Projects"
                    scopes={scopes.project}
                    initialScopes={temporaryScopes.project}
                    selectedScopes={temporaryScopes.project}
                    onChange={scopes => {
                      setTemporaryScopes(prev => ({
                        ...prev,
                        project: scopes,
                      }));
                    }}
                    checkAccess={() => true}
                  />
                  <PermissionsSpace
                    title="Targets"
                    scopes={scopes.target}
                    initialScopes={temporaryScopes.target}
                    selectedScopes={temporaryScopes.target}
                    onChange={scopes => {
                      setTemporaryScopes(prev => ({
                        ...prev,
                        target: scopes,
                      }));
                    }}
                    checkAccess={() => true}
                  />
                </Tabs>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCustomAccessModalOpen(false);
                      resetCustomRolesToPreviousSave();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // unassign role
                      form.setValue('roleId', '');
                      // save new scopes
                      form.setValue('organizationScopes', [...temporaryScopes.organization]);
                      form.setValue('projectScopes', [...temporaryScopes.project]);
                      form.setValue('targetScopes', [...temporaryScopes.target]);
                      saveCustomRoles();
                      // close the dialog
                      setCustomAccessModalOpen(false);
                    }}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </td>
        <td className="py-4 text-center text-yellow-500">
          <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
              <LightbulbIcon className="h-5 w-5 cursor-pointer" />
            </HoverCardTrigger>
            <HoverCardContent side="left" className="min-w-[350px] text-left">
              <SimilarRoles
                roles={props.roles}
                memberGroupOrganizationScopes={newRoleScopes.organization}
                memberGroupProjectScopes={newRoleScopes.project}
                memberGroupTargetScopes={newRoleScopes.target}
              />
            </HoverCardContent>
          </HoverCard>
        </td>
        <td className="py-4 text-center">
          <AlertDialog
            open={confirmationOpen}
            onOpenChange={open => {
              setConfirmationOpen(open);
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                disabled={
                  form.formState.disabled || form.formState.isSubmitting || !form.formState.isValid
                }
              >
                Migrate
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently modify the permissions of{' '}
                  {memberGroup.members.length}{' '}
                  {memberGroup.members.length > 1 ? 'members' : 'member'}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={migrationState.fetching}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={migrationState.fetching}
                  onClick={async event => {
                    void form.handleSubmit(onSubmit)(event);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </td>
      </tr>
    </Form>
  );
}

const OrganizationMemberRolesMigration_OrganizationFragment = graphql(`
  fragment OrganizationMemberRolesMigration_OrganizationFragment on Organization {
    id
    cleanId
    me {
      id
      isAdmin
    }
    memberRoles {
      id
      name
      description
      organizationAccessScopes
      projectAccessScopes
      targetAccessScopes
    }
    unassignedMembersToMigrate {
      id
      ...OrganizationMemberRolesMigrationGroup_MemberRoleMigrationGroup
    }
  }
`);

export function OrganizationMemberRolesMigration(props: {
  organization: FragmentType<typeof OrganizationMemberRolesMigration_OrganizationFragment>;
}) {
  const organization = useFragment(
    OrganizationMemberRolesMigration_OrganizationFragment,
    props.organization,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <CardTitle>Migration Wizard</CardTitle>
        <CardDescription>
          This wizard will help you migrate your organization's members to the new permissions
          system.
        </CardDescription>
        <CardDescription>
          Members are grouped by their access scopes.
          <br /> You can choose to migrate all members from each group to a new role or assign them
          to an existing role.
        </CardDescription>
      </div>
      {organization.unassignedMembersToMigrate.length > 0 ? (
        <table className="w-full table-auto divide-y-[1px] divide-gray-500/20">
          <thead>
            <tr>
              <th className="w-[170px] py-4 text-left text-sm font-semibold">Role</th>
              <th className="px-2 py-4 text-left text-sm font-semibold">Description</th>
              <th className="w-[120px] py-4 text-center text-sm font-semibold">Members</th>
              <th className="w-[260px] py-4 text-center text-sm font-semibold">Access</th>
              <th className="w-5 py-4" />
              <th className="w-32 py-4 text-center text-sm font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-[1px] divide-gray-500/20">
            {organization.unassignedMembersToMigrate.map(memberGroup => (
              <OrganizationMemberRolesMigrationGroup
                key={memberGroup.id}
                memberGroup={memberGroup}
                roles={organization.memberRoles}
                organizationCleanId={organization.cleanId}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex h-[250px] shrink-0 items-center justify-center rounded-md border border-dashed">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <PartyPopperIcon className="h-10 w-10 text-emerald-500" />

            <h3 className="mt-4 text-lg font-semibold">Migration completed</h3>
            <p className="text-muted-foreground mb-4 mt-2 text-sm">
              You have assigned a role to every member. Congratulations!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
