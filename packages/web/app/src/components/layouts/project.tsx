import { ReactNode } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { UserMenu } from '@/components/ui/user-menu';
import { graphql } from '@/gql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from '@tanstack/react-router';
import { ProjectMigrationToast } from '../project/migration-toast';
import { HiveLink } from '../ui/hive-link';
import { PlusIcon } from '../ui/icon';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { ProjectSelector } from './project-selector';

export enum Page {
  Targets = 'targets',
  Alerts = 'alerts',
  Policy = 'policy',
  Settings = 'settings',
}

const ProjectLayoutQuery = graphql(`
  query ProjectLayoutQuery {
    me {
      id
      ...UserMenu_MeFragment
    }
    organizations {
      nodes {
        id
        slug
        me {
          id
          ...CanAccessProject_MemberFragment
        }
        projects {
          nodes {
            id
            slug
            registryModel
          }
        }
      }
      ...ProjectSelector_OrganizationConnectionFragment
      ...UserMenu_OrganizationConnectionFragment
    }
  }
`);

export function ProjectLayout({
  children,
  page,
  className,
  ...props
}: {
  page: Page;
  organizationSlug: string;
  projectSlug: string;
  className?: string;
  children: ReactNode;
}) {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: ProjectLayoutQuery,
    requestPolicy: 'cache-first',
  });

  const me = query.data?.me;
  const currentOrganization = query.data?.organizations.nodes.find(
    node => node.slug === props.organizationSlug,
  );
  const currentProject = currentOrganization?.projects.nodes.find(
    node => node.slug === props.projectSlug,
  );

  useProjectAccess({
    scope: ProjectAccessScope.Read,
    member: currentOrganization?.me ?? null,
    redirect: true,
    organizationSlug: props.organizationSlug,
    projectSlug: props.projectSlug,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.slug);

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <ProjectSelector
              currentOrganizationSlug={props.organizationSlug}
              currentProjectSlug={props.projectSlug}
              organizations={query.data?.organizations ?? null}
            />
          </div>
          <div>
            <UserMenu
              me={me ?? null}
              currentOrganizationSlug={props.organizationSlug}
              organizations={query.data?.organizations ?? null}
            />
          </div>
        </div>
      </header>

      {page === Page.Settings || currentProject?.registryModel !== 'LEGACY' ? null : (
        <ProjectMigrationToast
          organizationSlug={props.organizationSlug}
          projectSlug={currentProject.slug}
        />
      )}

      <div className="relative h-[--tabs-navbar-height] border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && currentProject ? (
            <Tabs value={page}>
              <TabsList variant="menu">
                <TabsTrigger variant="menu" value={Page.Targets} asChild>
                  <Link
                    to="/$organizationSlug/$projectSlug"
                    params={{
                      organizationSlug: currentOrganization.slug,
                      projectSlug: currentProject.slug,
                    }}
                  >
                    Targets
                  </Link>
                </TabsTrigger>
                {canAccessProject(ProjectAccessScope.Alerts, currentOrganization.me) && (
                  <TabsTrigger variant="menu" value={Page.Alerts} asChild>
                    <Link
                      to="/$organizationSlug/$projectSlug/view/alerts"
                      params={{
                        organizationSlug: currentOrganization.slug,
                        projectSlug: currentProject.slug,
                      }}
                    >
                      Alerts
                    </Link>
                  </TabsTrigger>
                )}
                {canAccessProject(ProjectAccessScope.Settings, currentOrganization.me) && (
                  <>
                    <TabsTrigger variant="menu" value={Page.Policy} asChild>
                      <Link
                        to="/$organizationSlug/$projectSlug/view/policy"
                        params={{
                          organizationSlug: currentOrganization.slug,
                          projectSlug: currentProject.slug,
                        }}
                      >
                        Policy
                      </Link>
                    </TabsTrigger>
                    <TabsTrigger variant="menu" value={Page.Settings} asChild>
                      <Link
                        to="/$organizationSlug/$projectSlug/view/settings"
                        params={{
                          organizationSlug: currentOrganization.slug,
                          projectSlug: currentProject.slug,
                        }}
                      >
                        Settings
                      </Link>
                    </TabsTrigger>
                  </>
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
          {currentProject ? (
            <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
              <PlusIcon size={16} className="mr-2" />
              New target
            </Button>
          ) : null}
          <CreateTargetModal
            organizationSlug={props.organizationSlug}
            projectSlug={props.projectSlug}
            isOpen={isModalOpen}
            toggleModalOpen={toggleModalOpen}
          />
        </div>
      </div>
      <div className="container min-h-[var(--content-height)] pb-7">
        <div className={className}>{children}</div>
      </div>
    </>
  );
}

export const CreateTarget_CreateTargetMutation = graphql(`
  mutation CreateTarget_CreateTarget($input: CreateTargetInput!) {
    createTarget(input: $input) {
      ok {
        selector {
          organizationSlug
          projectSlug
          targetSlug
        }
        createdTarget {
          id
          slug
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

const createTargetFormSchema = z.object({
  targetSlug: z
    .string({
      required_error: 'Target slug is required',
    })
    .min(2, {
      message: 'Target slug must be at least 2 characters long',
    })
    .max(50, {
      message: 'Target slug must be at most 50 characters long',
    }),
});

function CreateTargetModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
  projectSlug: string;
}) {
  const { organizationSlug, projectSlug } = props;
  const [_, mutate] = useMutation(CreateTarget_CreateTargetMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof createTargetFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(createTargetFormSchema),
    defaultValues: {
      targetSlug: '',
    },
  });

  async function onSubmit(values: z.infer<typeof createTargetFormSchema>) {
    const { data, error } = await mutate({
      input: {
        projectSlug: props.projectSlug,
        organizationSlug: props.organizationSlug,
        slug: values.targetSlug,
      },
    });

    if (data?.createTarget.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug',
        params: {
          organizationSlug,
          projectSlug,
          targetSlug: data.createTarget.ok.createdTarget.slug,
        },
      });
      toast({
        variant: 'default',
        title: 'Target created',
        description: `Your target "${data.createTarget.ok.createdTarget.slug}" has been created`,
      });
    } else if (data?.createTarget.error?.inputErrors.slug) {
      form.setError('targetSlug', {
        message: data?.createTarget.error?.inputErrors.slug,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create target',
        description: error?.message || data?.createTarget.error?.message,
      });
    }
  }

  return (
    <CreateTargetModalContent
      form={form}
      isOpen={props.isOpen}
      onSubmit={onSubmit}
      toggleModalOpen={props.toggleModalOpen}
    />
  );
}

export function CreateTargetModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  onSubmit: (values: z.infer<typeof createTargetFormSchema>) => void | Promise<void>;
  form: UseFormReturn<z.infer<typeof createTargetFormSchema>>;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="container w-4/5 max-w-[520px] md:w-3/5">
        <Form {...props.form}>
          <form className="space-y-8" onSubmit={props.form.handleSubmit(props.onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a new target</DialogTitle>
              <DialogDescription>
                A project is built on top of <b>Targets</b>, which are just your environments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-8">
              <FormField
                control={props.form.control}
                name="targetSlug"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="my-target" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
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
                {props.form.formState.isSubmitting ? 'Submitting...' : 'Create Target'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
