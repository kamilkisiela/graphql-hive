import { FunctionComponentElement, ReactElement, ReactNode } from 'react';
import { BlocksIcon, BoxIcon, FoldVerticalIcon } from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { UserMenu } from '@/components/ui/user-menu';
import { env } from '@/env/frontend';
import { graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { Slot } from '@radix-ui/react-slot';
import { Link, useRouter } from '@tanstack/react-router';
import { ProPlanBilling } from '../organization/billing/ProPlanBillingWarm';
import { RateLimitWarn } from '../organization/billing/RateLimitWarn';
import { HiveLink } from '../ui/hive-link';
import { PlusIcon } from '../ui/icon';
import { QueryError } from '../ui/query-error';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { OrganizationSelector } from './organization-selectors';

export enum Page {
  Overview = 'overview',
  Members = 'members',
  Settings = 'settings',
  Policy = 'policy',
  Support = 'support',
  Subscription = 'subscription',
}

const OrganizationLayout_OrganizationFragment = graphql(`
  fragment OrganizationLayout_OrganizationFragment on Organization {
    id
    slug
    me {
      ...CanAccessOrganization_MemberFragment
    }
    ...ProPlanBilling_OrganizationFragment
    ...RateLimitWarn_OrganizationFragment
  }
`);

const OrganizationLayoutQuery = graphql(`
  query OrganizationLayoutQuery {
    me {
      id
      ...UserMenu_MeFragment
    }
    organizations {
      ...OrganizationSelector_OrganizationConnectionFragment
      ...UserMenu_OrganizationConnectionFragment
      nodes {
        ...OrganizationLayout_OrganizationFragment
      }
    }
  }
`);

export function OrganizationLayout({
  children,
  page,
  className,
  ...props
}: {
  page?: Page;
  className?: string;
  organizationSlug: string;
  children: ReactNode;
}): ReactElement | null {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: OrganizationLayoutQuery,
    requestPolicy: 'cache-first',
  });

  const organizations = useFragment(
    OrganizationLayout_OrganizationFragment,
    query.data?.organizations.nodes,
  );
  const currentOrganization = organizations?.find(org => org.slug === props.organizationSlug);

  useOrganizationAccess({
    member: currentOrganization?.me ?? null,
    scope: OrganizationAccessScope.Read,
    redirect: true,
    organizationSlug: props.organizationSlug,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.slug);

  const meInCurrentOrg = currentOrganization?.me;

  if (query.error) {
    return <QueryError error={query.error} organizationSlug={props.organizationSlug} />;
  }

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <OrganizationSelector
              currentOrganizationSlug={props.organizationSlug}
              organizations={query.data?.organizations ?? null}
            />
          </div>
          <div>
            <UserMenu
              me={query.data?.me ?? null}
              currentOrganizationSlug={props.organizationSlug}
              organizations={query.data?.organizations ?? null}
            />
          </div>
        </div>
      </header>
      <div className="relative h-[--tabs-navbar-height] border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && meInCurrentOrg ? (
            <Tabs value={page} className="min-w-[600px]">
              <TabsList variant="menu">
                <TabsTrigger variant="menu" value={Page.Overview} asChild>
                  <Link
                    to="/$organizationSlug"
                    params={{ organizationSlug: currentOrganization.slug }}
                  >
                    Overview
                  </Link>
                </TabsTrigger>
                {canAccessOrganization(OrganizationAccessScope.Members, meInCurrentOrg) && (
                  <TabsTrigger variant="menu" value={Page.Members} asChild>
                    <Link
                      to="/$organizationSlug/view/members"
                      params={{ organizationSlug: currentOrganization.slug }}
                      search={{ page: 'list' }}
                    >
                      Members
                    </Link>
                  </TabsTrigger>
                )}
                {canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                  <>
                    <TabsTrigger variant="menu" value={Page.Policy} asChild>
                      <Link
                        to="/$organizationSlug/view/policy"
                        params={{ organizationSlug: currentOrganization.slug }}
                      >
                        Policy
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.Settings} asChild>
                      <Link
                        to="/$organizationSlug/view/settings"
                        params={{ organizationSlug: currentOrganization.slug }}
                      >
                        Settings
                      </Link>
                    </TabsTrigger>
                  </>
                )}
                {canAccessOrganization(OrganizationAccessScope.Read, meInCurrentOrg) &&
                  env.zendeskSupport && (
                    <TabsTrigger variant="menu" value={Page.Support} asChild>
                      <Link
                        to="/$organizationSlug/view/support"
                        params={{ organizationSlug: currentOrganization.slug }}
                      >
                        Support
                      </Link>
                    </TabsTrigger>
                  )}
                {getIsStripeEnabled() &&
                  canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                    <TabsTrigger variant="menu" value={Page.Subscription} asChild>
                      <Link
                        to="/$organizationSlug/view/subscription"
                        params={{ organizationSlug: currentOrganization.slug }}
                      >
                        Subscription
                      </Link>
                    </TabsTrigger>
                  )}
              </TabsList>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 border-b-2 border-b-transparent px-4 py-3">
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
            </div>
          )}
          {currentOrganization ? (
            <>
              <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
                <PlusIcon size={16} className="mr-2" />
                New project
              </Button>
              <CreateProjectModal
                organizationSlug={props.organizationSlug}
                isOpen={isModalOpen}
                toggleModalOpen={toggleModalOpen}
                // reset the form every time it is closed
                key={String(isModalOpen)}
              />
            </>
          ) : null}
        </div>
      </div>
      <div className="container min-h-[var(--content-height)] pb-7">
        {currentOrganization ? (
          <>
            <ProPlanBilling organization={currentOrganization} />
            <RateLimitWarn organization={currentOrganization} />
          </>
        ) : null}
        <div className={className}>{children}</div>
      </div>
    </>
  );
}

export const CreateProjectMutation = graphql(`
  mutation CreateProject_CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ok {
        createdProject {
          id
          slug
        }
        createdTargets {
          id
          slug
        }
        updatedOrganization {
          id
        }
      }
      error {
        message
        inputErrors {
          slug
        }
      }
    }
  }
`);

const createProjectFormSchema = z.object({
  projectSlug: z
    .string({
      required_error: 'Project slug is required',
    })
    .min(2, {
      message: 'Project slug must be at least 2 characters long',
    })
    .max(50, {
      message: 'Project slug must be at most 50 characters long',
    }),
  projectType: z.nativeEnum(ProjectType, {
    required_error: 'Project type is required',
  }),
});

function ProjectTypeCard(props: {
  title: string;
  description: string;
  type: ProjectType;
  icon: FunctionComponentElement<{ className: string }>;
}) {
  return (
    <FormItem>
      <FormLabel className="[&:has([data-state=checked])>div]:border-primary cursor-pointer">
        <FormControl>
          <RadioGroupItem value={props.type} className="sr-only" />
        </FormControl>
        <div className="border-muted hover:border-accent hover:bg-accent flex items-center gap-4 rounded-md border-2 p-4">
          <Slot className="size-8 text-gray-400">{props.icon}</Slot>
          <div>
            <span className="text-sm font-medium">{props.title}</span>
            <p className="text-sm text-gray-400">{props.description}</p>
          </div>
        </div>
      </FormLabel>
    </FormItem>
  );
}

function CreateProjectModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
}) {
  const [_, mutate] = useMutation(CreateProjectMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof createProjectFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      projectSlug: '',
      projectType: ProjectType.Single,
    },
  });

  async function onSubmit(values: z.infer<typeof createProjectFormSchema>) {
    const { data, error } = await mutate({
      input: {
        organizationSlug: props.organizationSlug,
        slug: values.projectSlug,
        type: values.projectType,
      },
    });
    if (data?.createProject.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationSlug/$projectSlug',
        params: {
          organizationSlug: props.organizationSlug,
          projectSlug: data.createProject.ok.createdProject.slug,
        },
      });
    } else if (data?.createProject.error?.inputErrors.slug) {
      form.setError('projectSlug', {
        message: data?.createProject.error?.inputErrors.slug,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create project',
        description: error?.message || data?.createProject.error?.message,
      });
    }
  }

  return (
    <CreateProjectModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      form={form}
      onSubmit={onSubmit}
    />
  );
}

export function CreateProjectModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  form: UseFormReturn<z.infer<typeof createProjectFormSchema>>;
  onSubmit: (values: z.infer<typeof createProjectFormSchema>) => void | Promise<void>;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
        <Form {...props.form}>
          <form onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader className="mb-8">
              <DialogTitle>Create a project</DialogTitle>
              <DialogDescription>
                A Hive <b>project</b> represents a <b>GraphQL API</b> running a GraphQL schema.
              </DialogDescription>
            </DialogHeader>
            <div>
              <FormField
                control={props.form.control}
                name="projectSlug"
                render={({ field }) => {
                  return (
                    <FormItem className="mt-0">
                      <FormLabel>Slug of your project</FormLabel>
                      <FormControl>
                        <Input placeholder="my-project" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={props.form.control}
                name="projectType"
                render={({ field }) => {
                  return (
                    <FormItem className="mt-2">
                      <FormLabel>Project Type</FormLabel>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
                        <ProjectTypeCard
                          type={ProjectType.Single}
                          title="Monolith"
                          description="Single GraphQL schema developed as a monolith"
                          icon={
                            <BoxIcon
                              className={cn(field.value === ProjectType.Single && 'text-white')}
                            />
                          }
                        />
                        <ProjectTypeCard
                          type={ProjectType.Federation}
                          title="Federation"
                          description="Project developed according to Apollo Federation specification"
                          icon={
                            <BlocksIcon
                              className={cn(field.value === ProjectType.Federation && 'text-white')}
                            />
                          }
                        />
                        <ProjectTypeCard
                          type={ProjectType.Stitching}
                          title="Stitching"
                          description="Project that stitches together multiple GraphQL APIs"
                          icon={
                            <FoldVerticalIcon
                              className={cn(field.value === ProjectType.Stitching && 'text-white')}
                            />
                          }
                        />
                      </RadioGroup>
                    </FormItem>
                  );
                }}
              />
            </div>
            <DialogFooter className="mt-8">
              <Button
                className="w-full"
                type="submit"
                disabled={props.form.formState.isSubmitting || !props.form.formState.isValid}
              >
                {props.form.formState.isSubmitting ? 'Submitting...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
