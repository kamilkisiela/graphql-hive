import { useCallback } from 'react';
import NextLink from 'next/link';
import { PencilIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { Priority, priorityDescription, Status } from '@/components/organization/support';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { TimeAgo } from '@/components/ui/time-ago';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MetaTitle } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { SupportTicketPriority, SupportTicketStatus } from '@/gql/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';

const newTicketFormSchema = z.object({
  subject: z.string().min(2, {
    message: 'Subject must be at least 2 characters.',
  }),
  priority: z.nativeEnum(SupportTicketPriority, {
    required_error: 'A priority is required.',
  }),
  description: z.string().min(5, {
    message: 'Description must be at least 5 characters.',
  }),
});

type NewTicketFormValues = z.infer<typeof newTicketFormSchema>;

export const NewTicketForm_SupportTicketCreateMutation = graphql(`
  mutation NewTicketForm_SupportTicketCreateMutation($input: SupportTicketCreateInput!) {
    supportTicketCreate(input: $input) {
      ok {
        supportTicketId
      }
      error {
        message
      }
    }
  }
`);

function NewTicketForm(props: {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const notify = useNotifications();
  const form = useForm<NewTicketFormValues>({
    resolver: zodResolver(newTicketFormSchema),
    defaultValues: {
      subject: '',
      priority: SupportTicketPriority.Normal,
      description: '',
    },
  });
  const [_, mutate] = useMutation(NewTicketForm_SupportTicketCreateMutation);

  const onClose = useCallback(() => {
    form.reset({
      subject: '',
      priority: SupportTicketPriority.Normal,
      description: '',
    });
    props.onClose();
  }, [form.reset]);

  async function onSubmit(data: NewTicketFormValues) {
    try {
      const result = await mutate({
        input: {
          organization: props.organizationId,
          subject: data.subject,
          priority: data.priority,
          description: data.description,
        },
      });

      if (result.error) {
        notify(`Failed to submit your ticket: ${result.error.message}`, 'error');
        return;
      }

      if (result.data?.supportTicketCreate.ok) {
        notify('Your ticket has been submitted.', 'success');
        props.onSubmit();
      } else if (result.data?.supportTicketCreate.error) {
        notify(
          `Failed to submit your ticket: ${result.data.supportTicketCreate.error.message}`,
          'error',
        );
      }
    } catch (error) {
      notify(`Failed to submit your ticket: ${String(error)}`, 'error');
    }
  }

  return (
    <Sheet
      defaultOpen={false}
      open={props.isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="flex h-full w-1/3 max-w-none grow flex-col sm:w-1/2 sm:max-w-none md:w-1/3 md:max-w-[500px]">
        <Form {...form}>
          <form
            className="flex h-full grow flex-col justify-between gap-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <SheetHeader>
              <SheetTitle>New ticket</SheetTitle>
              <SheetDescription className="text-ellipsis">
                Create a new case for the support team
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1">
              <div className="w-full space-y-6 overflow-y-auto text-ellipsis px-2 text-sm">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Priority level</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={SupportTicketPriority.Normal} />
                            </FormControl>
                            <FormLabel className="font-normal text-gray-400">
                              <span className="font-semibold text-white">Normal</span> -{' '}
                              {priorityDescription[SupportTicketPriority.Normal]}
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={SupportTicketPriority.High} />
                            </FormControl>
                            <FormLabel className="font-normal text-gray-400">
                              <span className="font-semibold text-white">High</span> -{' '}
                              {priorityDescription[SupportTicketPriority.High]}
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={SupportTicketPriority.Urgent} />
                            </FormControl>
                            <FormLabel className="font-normal text-gray-400">
                              <span className="font-semibold text-white">Urgent</span> -{' '}
                              {priorityDescription[SupportTicketPriority.Urgent]}
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a subject of your issue" {...field} />
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
                        <Textarea
                          placeholder="Enter a short description of your issue"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Help us understand it better.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <SheetFooter className="flex flex-col gap-y-2 sm:flex-col">
              <Button type="submit">Submit</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

const SupportTicketRow_SupportTicket = graphql(`
  fragment SupportTicketRow_SupportTicket on SupportTicket {
    id
    status
    priority
    updatedAt
    subject
  }
`);

function SupportTicketRow(props: {
  organizationId: string;
  ticket: FragmentType<typeof SupportTicketRow_SupportTicket>;
}) {
  const ticket = useFragment(SupportTicketRow_SupportTicket, props.ticket);
  const isSolved = ticket.status === SupportTicketStatus.Solved;

  return (
    <TableRow className={cn(isSolved ? 'text-gray-500' : '')}>
      <TableCell className="text-center">{ticket.id}</TableCell>
      <TableCell>
        <Button
          variant="link"
          className={cn(isSolved ? 'text-gray-500' : '', 'h-auto p-0 text-left')}
          asChild
        >
          <NextLink
            href={{
              pathname: '/[organizationId]/view/support/[ticketId]',
              query: {
                organizationId: props.organizationId,
                ticketId: ticket.id,
              },
            }}
          >
            {ticket.subject}
          </NextLink>
        </Button>
      </TableCell>
      <TableCell className="w-[150px] text-center">
        <Status status={ticket.status} />
      </TableCell>
      <TableCell className="w-[150px] text-center">
        <Priority level={ticket.priority} />
      </TableCell>
      <TableCell className="w-[200px] text-right text-xs">
        <TimeAgo date={ticket.updatedAt} className="text-gray-500" />
      </TableCell>
    </TableRow>
  );
}

const Support_OrganizationFragment = graphql(`
  fragment Support_OrganizationFragment on Organization {
    cleanId
    name
    me {
      ...CanAccessOrganization_MemberFragment
      isOwner
    }
    supportTickets {
      ...Support_SupportTicketConnection
    }
  }
`);

const Support_SupportTicketConnection = graphql(`
  fragment Support_SupportTicketConnection on SupportTicketConnection {
    edges {
      node {
        id
        ...SupportTicketRow_SupportTicket
      }
    }
  }
`);

function Support(props: {
  organization: FragmentType<typeof Support_OrganizationFragment>;
  refetch: () => void;
}) {
  const organization = useFragment(Support_OrganizationFragment, props.organization);
  const supportTicketsConnection = useFragment(
    Support_SupportTicketConnection,
    organization.supportTickets,
  );
  const [isOpen, toggle] = useToggle();
  const onSubmit = useCallback(() => {
    toggle();
    props.refetch();
  }, [toggle, props.refetch]);
  useOrganizationAccess({
    scope: OrganizationAccessScope.Read,
    member: organization.me,
    redirect: true,
  });

  const tickets = supportTicketsConnection?.edges.map(e => e.node);

  return (
    <TooltipProvider>
      <div>
        <div className="flex flex-row items-center justify-between py-6">
          <div>
            <Title>Support</Title>
            <Subtitle>A list of support requests</Subtitle>
          </div>
          <div>
            <Button variant="outline" onClick={toggle}>
              <PencilIcon className="mr-2 size-4" />
              New ticket
            </Button>
            <NewTicketForm
              isOpen={isOpen}
              onClose={toggle}
              organizationId={organization.cleanId}
              onSubmit={onSubmit}
            />
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] text-center">ID</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-[150px] text-center">Status</TableHead>
                <TableHead className="w-[150px] text-center">Priority</TableHead>
                <TableHead className="w-[150px] text-right">Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tickets ?? []).map(ticket => (
                <SupportTicketRow
                  key={ticket.id}
                  organizationId={organization.cleanId}
                  ticket={ticket}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

const SupportPageQuery = graphql(`
  query SupportPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_CurrentOrganizationFragment
        ...Support_OrganizationFragment
      }
    }
    organizations {
      ...OrganizationLayout_OrganizationConnectionFragment
    }
    me {
      ...OrganizationLayout_MeFragment
    }
  }
`);

function SupportPageContent() {
  const router = useRouteSelector();
  const [query, refetchQuery] = useQuery({
    query: SupportPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
    requestPolicy: 'cache-first',
  });

  const refetch = useCallback(() => {
    refetchQuery({ requestPolicy: 'cache-and-network' });
  }, [refetchQuery]);

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;

  return (
    <OrganizationLayout
      page={Page.Support}
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
    >
      {currentOrganization ? (
        <Support organization={currentOrganization} refetch={refetch} />
      ) : null}
    </OrganizationLayout>
  );
}

function SupportPage() {
  return (
    <>
      <MetaTitle title="Support" />
      <SupportPageContent />
    </>
  );
}

export default authenticated(SupportPage);
