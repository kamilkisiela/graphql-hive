import { useCallback, useState } from 'react';
import { MailQuestionIcon, MoreHorizontalIcon } from 'lucide-react';
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useClipboard } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { RoleSelector } from './common';

const MemberInvitationForm_InviteByEmail = graphql(`
  mutation MemberInvitationForm_InviteByEmail($input: InviteToOrganizationByEmailInput!) {
    inviteToOrganizationByEmail(input: $input) {
      ok {
        ...Members_Invitation
        email
        id
      }
      error {
        message
        inputErrors {
          email
        }
      }
    }
  }
`);

const MemberInvitationForm_OrganizationFragment = graphql(`
  fragment MemberInvitationForm_OrganizationFragment on Organization {
    id
    cleanId
    memberRoles {
      id
      name
      description
      locked
      canInvite
    }
  }
`);

const memberInvitationFormSchema = z.object({
  email: z
    .string({
      required_error: 'Please enter email address',
    })
    .max(128, 'Email address is too long')
    .email('Please enter valid email address'),
  role: z
    .string({
      required_error: 'Please select a role',
    })
    .min(1, 'Please select a role'),
});

type MemberInvitationFormValues = z.infer<typeof memberInvitationFormSchema>;

function MemberInvitationForm(props: {
  organization: FragmentType<typeof MemberInvitationForm_OrganizationFragment>;
  close(): void;
  refetchInvitations(): void;
}) {
  const { toast } = useToast();
  const organization = useFragment(MemberInvitationForm_OrganizationFragment, props.organization);
  const [invitation, invite] = useMutation(MemberInvitationForm_InviteByEmail);
  const viewerRole = organization.memberRoles.find(r => r.name === 'Viewer');

  const form = useForm<MemberInvitationFormValues>({
    resolver: zodResolver(memberInvitationFormSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      role: viewerRole?.id ?? '',
    },
    disabled: invitation.fetching,
  });

  if (!viewerRole) {
    console.error('Viewer role not found in organization member roles');
    return (
      <>
        <div className="text-red-500">Viewer role not found in organization member roles</div>
        <div className="text-gray-400">Please contact support.</div>
      </>
    );
  }

  async function onSubmit(data: MemberInvitationFormValues) {
    try {
      const result = await invite({
        input: {
          organization: organization.cleanId,
          email: data.email,
          role: data.role,
        },
      });

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to send an invitation',
          description: result.error.message,
        });
        return;
      }

      if (result.data?.inviteToOrganizationByEmail?.ok?.email) {
        toast({
          title: 'Invitation sent',
          description: `${result.data.inviteToOrganizationByEmail.ok.email} should receive an invitation email shortly.`,
        });
        form.reset({ email: '', role: '' });
        props.close();
        props.refetchInvitations();
      } else if (result.data?.inviteToOrganizationByEmail?.error?.message) {
        toast({
          variant: 'destructive',
          title: 'Failed to send an invitation',
          description: result.data?.inviteToOrganizationByEmail.error.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to send an invitation',
        description: String(error),
      });
    }
  }

  if (!viewerRole) {
    console.error('Viewer role not found in organization member roles');
    return (
      <>
        <div className="text-red-500">Viewer role not found in organization member roles</div>
        <div className="text-gray-400">Please contact support.</div>
      </>
    );
  }

  // TODO: fix visibility when screen is too small (height - elements are not visible... - this can happen when there's a lot of roles)
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membership Invitation</DialogTitle>
            <DialogDescription>
              Enter the email address of the person you want to invite and select their role within
              the organization. Invitation expires after 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-row items-start space-x-6">
            <div className="grow">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Enter an email" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RoleSelector
                        roles={organization.memberRoles}
                        defaultRole={
                          organization.memberRoles.find(r => r.id === field.value) ?? viewerRole
                        }
                        isRoleActive={role => ({
                          active: role.canInvite,
                          reason: role.canInvite ? undefined : 'Not enough permissions',
                        })}
                        onSelect={role => {
                          field.onChange(role.id);
                          field.onBlur();
                        }}
                        onBlur={field.onBlur}
                        disabled={field.disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={form.formState.isSubmitting || !form.formState.isValid}
            >
              {form.formState.isSubmitting ? 'Sending invitation...' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Form>
  );
}

export function MemberInvitationButton(props: {
  organization: FragmentType<typeof MemberInvitationForm_OrganizationFragment>;
  refetchInvitations(): void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite a new member</Button>
      </DialogTrigger>
      {open ? (
        <MemberInvitationForm
          refetchInvitations={props.refetchInvitations}
          organization={props.organization}
          close={() => setOpen(false)}
        />
      ) : null}
    </Dialog>
  );
}

const DateFormatter = Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const InvitationDeleteButton_DeleteInvitation = graphql(`
  mutation InvitationDeleteButton_DeleteInvitation($input: DeleteOrganizationInvitationInput!) {
    deleteOrganizationInvitation(input: $input) {
      ok {
        ...Members_Invitation
      }
      error {
        message
      }
    }
  }
`);

const Members_Invitation = graphql(`
  fragment Members_Invitation on OrganizationInvitation {
    id
    createdAt
    expiresAt
    email
    code
    role {
      id
      name
    }
  }
`);

function Invitation(props: {
  invitation: FragmentType<typeof Members_Invitation>;
  organizationCleanId: string;
  refetchInvitations(): void;
}) {
  const invitation = useFragment(Members_Invitation, props.invitation);
  const copyToClipboard = useClipboard();
  const copyLink = useCallback(async () => {
    await copyToClipboard(`${window.location.origin}/join/${invitation.code}`);
  }, [invitation.code, copyToClipboard]);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteInvitationState, deleteInvitation] = useMutation(
    InvitationDeleteButton_DeleteInvitation,
  );

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        {open ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the invitation for{' '}
                <strong>{invitation.email}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteInvitationState.fetching}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteInvitationState.fetching}
                onClick={async event => {
                  event.preventDefault();

                  try {
                    const result = await deleteInvitation({
                      input: {
                        organization: props.organizationCleanId,
                        email: invitation.email,
                      },
                    });

                    if (result.error) {
                      toast({
                        variant: 'destructive',
                        title: 'Failed to delete invitation',
                        description: result.error.message,
                      });
                    } else if (result.data?.deleteOrganizationInvitation.error) {
                      toast({
                        variant: 'destructive',
                        title: 'Failed to delete invitation',
                        description: result.data?.deleteOrganizationInvitation.error.message,
                      });
                    } else if (result.data?.deleteOrganizationInvitation.ok) {
                      toast({
                        title: 'Invitation deleted',
                        description: `Invitation for ${invitation.email} has been deleted.`,
                      });
                      setOpen(false);
                      props.refetchInvitations();
                    }
                  } catch (error) {
                    console.log('Failed to delete invitation');
                    console.error(error);
                    toast({
                      variant: 'destructive',
                      title: 'Failed to delete invitation',
                      description: String(error),
                    });
                  }
                }}
              >
                {deleteInvitationState.fetching ? 'Deleting...' : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
      <tr>
        <td className="py-3 text-sm font-medium">{invitation.email}</td>
        <td className="py-3 text-center text-sm">{invitation.role.name}</td>
        <td className="py-3 text-center text-sm text-gray-400">
          {DateFormatter.format(new Date(invitation.expiresAt))}
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
              <DropdownMenuItem onClick={copyLink}>Copy invitation link</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpen(true)}>Delete invitation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    </>
  );
}

const OrganizationInvitations_OrganizationFragment = graphql(`
  fragment OrganizationInvitations_OrganizationFragment on Organization {
    id
    cleanId
    invitations {
      nodes {
        id
        ...Members_Invitation
      }
    }

    ...MemberInvitationForm_OrganizationFragment
  }
`);

export function OrganizationInvitations(props: {
  organization: FragmentType<typeof OrganizationInvitations_OrganizationFragment>;
  refetchInvitations(): void;
}) {
  const organization = useFragment(
    OrganizationInvitations_OrganizationFragment,
    props.organization,
  );

  if (organization.invitations.nodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="space-y-2">
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>
            Active invitations to join this organization. Invitations expire after 7 days.
          </CardDescription>
        </div>
        <div>
          <MemberInvitationButton
            refetchInvitations={props.refetchInvitations}
            organization={organization}
          />
        </div>
      </div>
      {organization.invitations.nodes.length > 0 ? (
        <table className="w-full table-auto divide-y-[1px] divide-gray-500/20">
          <thead>
            <tr>
              <th className="py-3 text-left text-sm font-semibold">Email</th>
              <th className="w-64 py-3 text-center text-sm font-semibold">Assigned role</th>
              <th className="w-32 py-3 text-center text-sm font-semibold">Expiration date</th>
              <th className="w-12 py-3 text-right text-sm font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y-[1px] divide-gray-500/20">
            {organization.invitations.nodes.map(node => (
              <Invitation
                key={node.id}
                invitation={node}
                organizationCleanId={organization.cleanId}
                refetchInvitations={props.refetchInvitations}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex h-[250px] shrink-0 items-center justify-center rounded-md border border-dashed">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <MailQuestionIcon className="text-muted-foreground h-10 w-10" />

            <h3 className="mt-4 text-lg font-semibold">No invitations</h3>
            <p className="text-muted-foreground mb-4 mt-2 text-sm">
              Invitations to join this organization will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
