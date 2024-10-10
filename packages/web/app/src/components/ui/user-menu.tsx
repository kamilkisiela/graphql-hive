import { ReactElement, useEffect } from 'react';
import cookies from 'js-cookie';
import { LifeBuoyIcon, LoaderCircleIcon } from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { FaGithub, FaGoogle, FaKey, FaUsersSlash } from 'react-icons/fa';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangleIcon,
  CalendarIcon,
  FileTextIcon,
  GraphQLIcon,
  GridIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  TrendingUpIcon,
} from '@/components/ui/icon';
import { Avatar } from '@/components/v2';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import { AuthProvider } from '@/gql/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useToggle } from '@/lib/hooks';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { GetStartedProgress } from '../get-started/trigger';
import { MemberRoleMigrationStickyNote } from '../organization/members/migration';
import { Changelog } from './changelog/changelog';
import { latestChangelog } from './changelog/generated-changelog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './form';
import { Input } from './input';
import { useToast } from './use-toast';

const UserMenu_OrganizationConnectionFragment = graphql(`
  fragment UserMenu_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      cleanId
      name
      me {
        ...UserMenu_MemberFragment
      }
      getStarted {
        ...GetStartedWizard_GetStartedProgress
      }
      ...MemberRoleMigrationStickyNote_OrganizationFragment
    }
  }
`);

const UserMenu_MeFragment = graphql(`
  fragment UserMenu_MeFragment on User {
    id
    email
    displayName
    provider
    isAdmin
    canSwitchOrganization
  }
`);

const UserMenu_MemberFragment = graphql(`
  fragment UserMenu_MemberFragment on Member {
    canLeaveOrganization
  }
`);

export function UserMenu(props: {
  me: FragmentType<typeof UserMenu_MeFragment> | null;
  organizations: FragmentType<typeof UserMenu_OrganizationConnectionFragment> | null;
  currentOrganizationCleanId: string;
}) {
  const docsUrl = getDocsUrl();
  const me = useFragment(UserMenu_MeFragment, props.me);
  const organizations = useFragment(
    UserMenu_OrganizationConnectionFragment,
    props.organizations,
  )?.nodes;
  const [isUserSettingsModalOpen, toggleUserSettingsModalOpen] = useToggle();
  const [isLeaveOrganizationModalOpen, toggleLeaveOrganizationModalOpen] = useToggle();
  const currentOrganization = organizations?.find(
    org => org.cleanId === props.currentOrganizationCleanId,
  );
  const meInOrg = useFragment(UserMenu_MemberFragment, currentOrganization?.me);

  const canLeaveOrganization = !!currentOrganization && meInOrg?.canLeaveOrganization === true;

  return (
    <>
      <UserSettingsModal
        toggleModalOpen={toggleUserSettingsModalOpen}
        isOpen={isUserSettingsModalOpen}
      />
      {canLeaveOrganization ? (
        <LeaveOrganizationModal
          toggleModalOpen={toggleLeaveOrganizationModalOpen}
          isOpen={isLeaveOrganizationModalOpen}
          organizationId={currentOrganization.cleanId}
          organizationName={currentOrganization.name}
        />
      ) : null}
      <div className="flex flex-row items-center gap-8">
        <Changelog changes={latestChangelog} />
        <MemberRoleMigrationStickyNote organization={currentOrganization} />
        {currentOrganization ? <GetStartedProgress tasks={currentOrganization.getStarted} /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className={cn('cursor-pointer', currentOrganization ? '' : 'animate-pulse')}
              data-cy="user-menu-trigger"
            >
              <Avatar shape="circle" className="border-2 border-orange-900/50" />
            </div>
          </DropdownMenuTrigger>

          {me && organizations ? (
            <DropdownMenuContent sideOffset={5} align="end" className="min-w-[240px]">
              <DropdownMenuLabel className="flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  <div className="truncate text-sm font-medium leading-none">{me?.displayName}</div>
                  <div className="text-muted-foreground truncate text-xs font-normal leading-none">
                    {me?.email}
                  </div>
                </div>
                <div>
                  {me?.provider === AuthProvider.Google ? (
                    <FaGoogle title="Signed in using Google" />
                  ) : me?.provider === AuthProvider.Github ? (
                    <FaGithub title="Signed in using Github" />
                  ) : (
                    <FaKey title="Signed in using username and password" />
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                {me?.canSwitchOrganization ? (
                  <DropdownMenuSubTrigger>
                    <GridIcon className="mr-2 size-4" />
                    Switch organization
                  </DropdownMenuSubTrigger>
                ) : null}
                <DropdownMenuSubContent className="max-w-[300px]">
                  {organizations.length ? (
                    <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                  ) : null}
                  <DropdownMenuSeparator />
                  {organizations.map(org => (
                    <DropdownMenuItem
                      asChild
                      key={org.cleanId}
                      active={currentOrganization?.cleanId === org.cleanId}
                    >
                      <Link
                        to="/$organizationId"
                        params={{
                          organizationId: org.cleanId,
                        }}
                      >
                        {org.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/org/new">
                      Create organization
                      <PlusIcon className="ml-2 size-4" />
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <a
                  href="https://cal.com/team/the-guild/graphql-hive-15m"
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarIcon className="mr-2 size-4" />
                  Schedule a meeting
                </a>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  toggleUserSettingsModalOpen();
                }}
              >
                <SettingsIcon className="mr-2 size-4" />
                Profile settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={docsUrl} target="_blank" rel="noreferrer">
                  <FileTextIcon className="mr-2 size-4" />
                  Documentation
                </a>
              </DropdownMenuItem>
              {currentOrganization && env.zendeskSupport ? (
                <DropdownMenuItem asChild>
                  <Link
                    to="/$organizationId/view/support"
                    params={{
                      organizationId: currentOrganization.cleanId,
                    }}
                  >
                    <LifeBuoyIcon className="mr-2 size-4" />
                    Support
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <a href="https://status.graphql-hive.com" target="_blank" rel="noreferrer">
                  <AlertTriangleIcon className="mr-2 size-4" />
                  Status page
                </a>
              </DropdownMenuItem>
              {me.isAdmin && (
                <Link to="/manage">
                  <DropdownMenuItem>
                    <TrendingUpIcon className="mr-2 size-4" />
                    Manage Instance
                  </DropdownMenuItem>
                </Link>
              )}
              {env.nodeEnv === 'development' && (
                <DropdownMenuItem asChild>
                  <Link to="/dev">
                    <GraphQLIcon className="mr-2 size-4" />
                    Dev GraphiQL
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canLeaveOrganization ? (
                <DropdownMenuItem
                  onClick={() => {
                    toggleLeaveOrganizationModalOpen();
                  }}
                >
                  <FaUsersSlash className="mr-2 size-4" />
                  Leave organization
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <a href="/logout" data-cy="user-menu-logout">
                  <LogOutIcon className="mr-2 size-4" />
                  Log out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          ) : null}
        </DropdownMenu>
      </div>
    </>
  );
}

const LeaveOrganizationModal_LeaveOrganizationMutation = graphql(`
  mutation LeaveOrganizationModal_LeaveOrganizationMutation($input: OrganizationSelectorInput!) {
    leaveOrganization(input: $input) {
      ok {
        organizationId
      }
      error {
        message
      }
    }
  }
`);

export function LeaveOrganizationModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
  organizationName: string;
}) {
  const { organizationId, organizationName } = props;
  const [, mutate] = useMutation(LeaveOrganizationModal_LeaveOrganizationMutation);
  const notify = useNotifications();

  async function onSubmit() {
    const result = await mutate({
      input: {
        organization: organizationId,
      },
    });

    if (result.error) {
      notify("Couldn't leave organization. Please try again.", 'error');
    }

    if (result.data?.leaveOrganization.error) {
      notify(result.data.leaveOrganization.error.message, 'error');
    }

    if (result.data?.leaveOrganization.ok) {
      props.toggleModalOpen();
      cookies.remove(LAST_VISITED_ORG_KEY);
      window.location.href = '/';
    }
  }

  return (
    <LeaveOrganizationModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      organizationName={organizationName}
      onSubmit={onSubmit}
    />
  );
}

export function LeaveOrganizationModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationName: string;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-4/5 max-w-[520px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Leave {props.organizationName}?</DialogTitle>
          <DialogDescription>
            Are you sure you want to leave this organization?
            <br />
            You will lose access to{' '}
            <span className="font-semibold text-white">{props.organizationName}</span>.
          </DialogDescription>
          <DialogDescription className="font-bold">This action is irreversible!</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            onClick={ev => {
              ev.preventDefault();
              props.toggleModalOpen();
            }}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={props.onSubmit}>
            Leave organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const UserSettings_MeQuery = graphql(`
  query UserSettings_MeQuery {
    me {
      id
      fullName
      displayName
      canSwitchOrganization
    }
  }
`);

const UpdateMeMutation = graphql(`
  mutation updateMe($input: UpdateMeInput!) {
    updateMe(input: $input) {
      ok {
        updatedUser {
          id
          fullName
          displayName
        }
      }
      error {
        message
        inputErrors {
          fullName
          displayName
        }
      }
    }
  }
`);

const userSettingsModalFormSchema = z.object({
  fullName: z
    .string({
      required_error: 'Full Name is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    }),
  displayName: z
    .string({
      required_error: 'Display Name is required',
    })
    .min(2, {
      message: 'Name must be at least 2 characters long',
    })
    .max(50, {
      message: 'Name must be at most 50 characters long',
    }),
});

export type UserSettingsModalFormValues = z.infer<typeof userSettingsModalFormSchema>;

export function UserSettingsModal({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement {
  const [meQuery] = useQuery({
    query: UserSettings_MeQuery,
    pause: !isOpen,
  });
  const [, mutate] = useMutation(UpdateMeMutation);
  const { toast } = useToast();

  const form = useForm<UserSettingsModalFormValues>({
    mode: 'all',
    resolver: zodResolver(userSettingsModalFormSchema),
    defaultValues: {
      fullName: '',
      displayName: '',
    },
  });

  useEffect(() => {
    if (meQuery.data?.me) {
      form.reset({
        fullName: meQuery.data.me.fullName || '',
        displayName: meQuery.data.me.displayName || '',
      });
    }
  }, [meQuery.data, form]);

  async function onSubmit(values: UserSettingsModalFormValues) {
    const { data } = await mutate({ input: values });
    if (data?.updateMe.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: data.updateMe.error.message,
      });
    } else if (data?.updateMe.ok) {
      toggleModalOpen();
      toast({
        variant: 'default',
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
      });
    }
  }

  return (
    <UserSettingsModalContent
      toggleModalOpen={toggleModalOpen}
      form={form}
      isOpen={isOpen}
      onSubmit={onSubmit}
      fetching={meQuery.fetching}
    />
  );
}

export function UserSettingsModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  form: UseFormReturn<UserSettingsModalFormValues>;
  onSubmit: (values: UserSettingsModalFormValues) => void;
  fetching?: boolean;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[400px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Profile settings</DialogTitle>
              <DialogDescription>Update your profile information.</DialogDescription>
            </DialogHeader>
            {props.fetching ? (
              <div className="flex justify-center">
                <LoaderCircleIcon className="mr-2 inline size-4 animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                <FormField
                  control={props.form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Your Full Name" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={props.form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Your Display Name" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <DialogFooter>
              <Button
                type="submit"
                size="lg"
                className="w-full justify-center"
                variant="primary"
                disabled={
                  props.form.formState.isSubmitting ||
                  !props.form.formState.isValid ||
                  props.fetching ||
                  !props.form.formState.isDirty
                }
                data-cy="confirm"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
