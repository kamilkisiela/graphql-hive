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
    cleanId
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
  organizationId: string;
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
  const currentOrganization = organizations?.find(org => org.cleanId === props.organizationId);

  useOrganizationAccess({
    member: currentOrganization?.me ?? null,
    scope: OrganizationAccessScope.Read,
    redirect: true,
    organizationId: props.organizationId,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.cleanId);

  const meInCurrentOrg = currentOrganization?.me;

  if (query.error) {
    return <QueryError error={query.error} organizationId={props.organizationId} />;
  }

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <OrganizationSelector
              currentOrganizationCleanId={props.organizationId}
              organizations={query.data?.organizations ?? null}
            />
          </div>
          <div>
            <UserMenu
              me={query.data?.me ?? null}
              currentOrganizationCleanId={props.organizationId}
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
                    to="/$organizationId"
                    params={{ organizationId: currentOrganization.cleanId }}
                  >
                    Overview
                  </Link>
                </TabsTrigger>
                {canAccessOrganization(OrganizationAccessScope.Members, meInCurrentOrg) && (
                  <TabsTrigger variant="menu" value={Page.Members} asChild>
                    <Link
                      to="/$organizationId/view/members"
                      params={{ organizationId: currentOrganization.cleanId }}
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
                        to="/$organizationId/view/policy"
                        params={{ organizationId: currentOrganization.cleanId }}
                      >
                        Policy
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.Settings} asChild>
                      <Link
                        to="/$organizationId/view/settings"
                        params={{ organizationId: currentOrganization.cleanId }}
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
                        to="/$organizationId/view/support"
                        params={{ organizationId: currentOrganization.cleanId }}
                      >
                        Support
                      </Link>
                    </TabsTrigger>
                  )}
                {getIsStripeEnabled() &&
                  canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                    <TabsTrigger variant="menu" value={Page.Subscription} asChild>
                      <Link
                        to="/$organizationId/view/subscription"
                        params={{ organizationId: currentOrganization.cleanId }}
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
                organizationId={props.organizationId}
                isOpen={isModalOpen}
                toggleModalOpen={toggleModalOpen}
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
          name
          cleanId
        }
        createdTargets {
          id
          name
          cleanId
        }
        updatedOrganization {
          id
        }
      }
      error {
        message
        inputErrors {
          name
          buildUrl
          validationUrl
        }
      }
    }
  }
`);

const createProjectFormSchema = z.object({
  projectName: z
    .string({
      required_error: 'Project name is required',
    })
    .min(2, {
      message: 'Project name must be at least 2 characters long',
    })
    .max(40, {
      message: 'Project name must be at most 40 characters long',
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
  organizationId: string;
}) {
  const [_, mutate] = useMutation(CreateProjectMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof createProjectFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      projectName: '',
      projectType: ProjectType.Single,
    },
  });

  async function onSubmit(values: z.infer<typeof createProjectFormSchema>) {
    const { data, error } = await mutate({
      input: {
        organization: props.organizationId,
        name: values.projectName,
        type: values.projectType,
      },
    });
    if (data?.createProject.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationId/$projectId',
        params: {
          organizationId: props.organizationId,
          projectId: data.createProject.ok.createdProject.cleanId,
        },
      });
    } else if (data?.createProject.error?.inputErrors.name) {
      form.setError('projectName', {
        message: data?.createProject.error?.inputErrors.name,
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
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
              <DialogDescription>
                A Hive <b>project</b> represents a <b>GraphQL API</b> running a GraphQL schema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="projectName"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Name of your project</FormLabel>
                      <FormControl>
                        <Input placeholder="My GraphQL API" autoComplete="off" {...field} />
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
                    <FormItem>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="pt-2"
                      >
                        <ProjectTypeCard
                          type={ProjectType.Single}
                          title="Single"
                          description="Monolithic GraphQL schema developed as a standalone"
                          icon={<BoxIcon />}
                        />
                        <ProjectTypeCard
                          type={ProjectType.Federation}
                          title="Federation"
                          description="Project developed according to Apollo Federation specification"
                          icon={<BlocksIcon />}
                        />
                        <ProjectTypeCard
                          type={ProjectType.Stitching}
                          title="Stitching"
                          description="Project that stitches together multiple GraphQL APIs"
                          icon={<FoldVerticalIcon />}
                        />
                      </RadioGroup>
                    </FormItem>
                  );
                }}
              />
            </div>
            <DialogFooter>
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
