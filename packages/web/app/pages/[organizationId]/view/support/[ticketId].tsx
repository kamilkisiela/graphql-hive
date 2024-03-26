import { useCallback, useMemo } from 'react';
import NextLink from 'next/link';
import { ChevronRightIcon, UserIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { priorityDescription, statusDescription } from '@/components/organization/support';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { NotFound } from '@/components/ui/not-found';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Textarea } from '@/components/ui/textarea';
import { TimeAgo } from '@/components/ui/time-ago';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetaTitle } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useNotifications, useRouteSelector } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';

const replyTicketFormSchema = z.object({
  body: z.string().min(2, {
    message: 'Comment must be at least 2 characters.',
  }),
});

type ReplyTicketFormValues = z.infer<typeof replyTicketFormSchema>;

const ReplyTicketForm_SupportTicketReplyMutation = graphql(`
  mutation ReplyTicketForm_SupportTicketReplyMutation($input: SupportTicketReplyInput!) {
    supportTicketReply(input: $input) {
      ok {
        supportTicketId
      }
      error {
        message
      }
    }
  }
`);

function ReplyTicketForm(props: {
  organizationId: string;
  ticketId: string;
  onSubmit: () => void;
}) {
  const notify = useNotifications();
  const form = useForm<ReplyTicketFormValues>({
    resolver: zodResolver(replyTicketFormSchema),
    defaultValues: {
      body: '',
    },
  });
  const [_, mutate] = useMutation(ReplyTicketForm_SupportTicketReplyMutation);

  async function onSubmit(data: ReplyTicketFormValues) {
    try {
      const result = await mutate({
        input: {
          organization: props.organizationId,
          ticketId: props.ticketId,
          body: data.body,
        },
      });

      if (result.error) {
        notify(`Failed to reply: ${result.error.message}`, 'error');
        return;
      }

      if (result.data?.supportTicketReply.ok) {
        props.onSubmit();
        notify('Replied to the ticket.', 'success');
        form.reset({ body: '' });
      } else if (result.data?.supportTicketReply.error) {
        notify(`Failed to reply: ${result.data.supportTicketReply.error.message}`, 'error');
      }
    } catch (error) {
      notify(`Failed to reply: ${String(error)}`, 'error');
    }
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea placeholder="Type your comment here." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-row gap-x-4">
          <Button type="submit">Reply</Button>
          <Button variant="link" type="reset" onClick={() => form.reset({ body: '' })}>
            Reset
          </Button>
        </div>
      </form>
    </Form>
  );
}

const Comment_SupportTicketComment = graphql(`
  fragment Comment_SupportTicketComment on SupportTicketComment {
    id
    createdAt
    body
    fromSupport
  }
`);

function Comment({ node }: { node: FragmentType<typeof Comment_SupportTicketComment> }) {
  const comment = useFragment(Comment_SupportTicketComment, node);

  const isSupport = comment.fromSupport;

  return (
    <div
      className={cn(
        'flex w-full flex-row items-end space-x-2',
        isSupport ? 'justify-end' : 'justify-start',
      )}
    >
      {isSupport ? null : <UserIcon className="size-6 text-orange-500" />}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'text-foreground inline-block max-w-[70%] rounded-lg bg-gray-800 p-2 text-left',
              isSupport ? 'rounded-br-none' : 'rounded-bl-none',
            )}
          >
            {comment.body}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <TimeAgo date={comment.createdAt} className="text-gray-500" />
        </TooltipContent>
      </Tooltip>
      {isSupport ? (
        <img className="block size-6" src="/just-logo.svg" alt="GraphQL Hive logo" />
      ) : null}
    </div>
  );
}

const SupportTicket_SupportTicketFragment = graphql(`
  fragment SupportTicket_SupportTicketFragment on SupportTicket {
    id
    status
    priority
    updatedAt
    subject
    description
    comments {
      edges {
        node {
          id
          ...Comment_SupportTicketComment
        }
      }
    }
  }
`);

function SupportTicket(props: {
  ticket: FragmentType<typeof SupportTicket_SupportTicketFragment>;
  organization: FragmentType<typeof SupportTicket_OrganizationFragment>;
  refetch: () => void;
}) {
  const ticket = useFragment(SupportTicket_SupportTicketFragment, props.ticket);
  const organization = useFragment(SupportTicket_OrganizationFragment, props.organization);
  useOrganizationAccess({
    scope: OrganizationAccessScope.Read,
    member: organization.me,
    redirect: true,
  });

  const commentEdges = ticket.comments?.edges;
  const comments = useMemo(() => {
    if (!!commentEdges && commentEdges.length > 0) {
      return commentEdges.slice().reverse();
    }

    return [];
  }, [commentEdges]);

  return (
    <TooltipProvider>
      <div className="py-6">
        <div className="flex flex-row items-start justify-between gap-x-6">
          <div className="flex-1 border-r border-gray-800 pr-6">
            <Title className="flex flex-row items-center gap-x-2">
              <Button
                variant="link"
                className="h-auto p-0 text-lg font-semibold tracking-tight"
                asChild
              >
                <NextLink
                  href={{
                    pathname: '/[organizationId]/view/support',
                    query: {
                      organizationId: organization.cleanId,
                    },
                  }}
                >
                  Tickets
                </NextLink>
              </Button>
              <span className="text-lg font-semibold tracking-tight text-gray-500">
                <ChevronRightIcon className="size-4" />
              </span>
              <span>{ticket.subject}</span>
            </Title>
            <Subtitle>Support ticket detailed view</Subtitle>
            <div className="space-y-6 py-12">
              {comments.map(comment => (
                <Comment key={comment.node.id} node={comment.node} />
              ))}

              <div className="mt-6">
                <ReplyTicketForm
                  organizationId={organization.cleanId}
                  ticketId={ticket.id}
                  onSubmit={props.refetch}
                />
              </div>
            </div>
          </div>
          <div className="w-1/3 shrink-0 text-sm">
            <div className="flex flex-col gap-y-6 text-left">
              <div className="space-y-0">
                <div className="font-semibold text-white">Support Ticket ID</div>
                <div className="text-muted-foreground">{ticket.id}</div>
              </div>
              <div className="space-y-0">
                <div className="font-semibold text-white">Status</div>
                <div className="text-muted-foreground">
                  {ticket.status}
                  <div className="text-xs">{statusDescription[ticket.status]}</div>
                </div>
              </div>
              <div className="space-y-0">
                <div className="font-semibold text-white">Priority</div>
                <div className="text-muted-foreground">
                  {ticket.priority}
                  <div className="text-xs">{priorityDescription[ticket.priority]}</div>
                </div>
              </div>
              <div className="space-y-0">
                <div className="font-semibold text-white">Last updated</div>
                <div>
                  <TimeAgo date={ticket.updatedAt} className="text-xs text-gray-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

const SupportTicket_OrganizationFragment = graphql(`
  fragment SupportTicket_OrganizationFragment on Organization {
    cleanId
    name
    me {
      ...CanAccessOrganization_MemberFragment
      isOwner
    }
  }
`);

const SupportTicketPageQuery = graphql(`
  query SupportTicketPageQuery($selector: OrganizationSelectorInput!, $ticketId: ID!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_CurrentOrganizationFragment
        ...SupportTicket_OrganizationFragment
        supportTicket(id: $ticketId) {
          ...SupportTicket_SupportTicketFragment
        }
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

function SupportTicketPageContent() {
  const router = useRouteSelector();
  const ticketId = router.query.ticketId as string;
  const [query, refetchQuery] = useQuery({
    query: SupportTicketPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
      ticketId,
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
  const ticket = query.data?.organization?.organization.supportTicket;

  return (
    <OrganizationLayout
      page={Page.Support}
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
    >
      {currentOrganization ? (
        ticket ? (
          <SupportTicket organization={currentOrganization} ticket={ticket} refetch={refetch} />
        ) : (
          <div className="py-6">
            <NotFound
              title="Support ticket not found."
              description="The support ticket you are looking for does not exist or you do not have access to it."
            />
          </div>
        )
      ) : null}
    </OrganizationLayout>
  );
}

function SupportTicketPage() {
  const router = useRouteSelector();
  const ticketId = router.query.ticketId as string;

  return (
    <>
      <MetaTitle title={`Support Ticket #${ticketId}`} />
      <SupportTicketPageContent />
    </>
  );
}

export default authenticated(SupportTicketPage);
