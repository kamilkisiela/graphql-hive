import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocsNote, ProductUpdatesLink } from '@/components/ui/docs-note';
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
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useNotifications } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, Cross2Icon, UpdateIcon } from '@radix-ui/react-icons';

const ExternalCompositionStatus_TestQuery = graphql(`
  query ExternalCompositionStatus_TestQuery($selector: TestExternalSchemaCompositionInput!) {
    testExternalSchemaComposition(selector: $selector) {
      ok {
        id
        isNativeFederationEnabled
        externalSchemaComposition {
          endpoint
        }
      }
      error {
        message
      }
    }
  }
`);

const ExternalCompositionForm_EnableMutation = graphql(`
  mutation ExternalCompositionForm_EnableMutation($input: EnableExternalSchemaCompositionInput!) {
    enableExternalSchemaComposition(input: $input) {
      ok {
        id
        isNativeFederationEnabled
        externalSchemaComposition {
          endpoint
        }
      }
      error {
        message
        inputErrors {
          endpoint
          secret
        }
      }
    }
  }
`);

const ExternalCompositionForm_OrganizationFragment = graphql(`
  fragment ExternalCompositionForm_OrganizationFragment on Organization {
    slug
  }
`);

const ExternalCompositionForm_ProjectFragment = graphql(`
  fragment ExternalCompositionForm_ProjectFragment on Project {
    slug
  }
`);

const ExternalCompositionStatus = ({
  projectSlug,
  organizationSlug,
}: {
  projectSlug: string;
  organizationSlug: string;
}) => {
  const [query] = useQuery({
    query: ExternalCompositionStatus_TestQuery,
    variables: {
      selector: {
        projectSlug,
        organizationSlug,
      },
    },
    requestPolicy: 'network-only',
  });

  const error = query.error?.message ?? query.data?.testExternalSchemaComposition?.error?.message;

  return (
    <TooltipProvider delayDuration={100}>
      {query.fetching ? (
        <Tooltip>
          <TooltipTrigger>
            <UpdateIcon className="size-5 animate-spin text-gray-500" />
          </TooltipTrigger>
          <TooltipContent side="right">Connecting...</TooltipContent>
        </Tooltip>
      ) : null}
      {error ? (
        <Tooltip>
          <TooltipTrigger>
            <Cross2Icon className="size-5 text-red-500" />
          </TooltipTrigger>
          <TooltipContent side="right">{error}</TooltipContent>
        </Tooltip>
      ) : null}
      {query.data?.testExternalSchemaComposition?.ok?.externalSchemaComposition?.endpoint ? (
        <Tooltip>
          <TooltipTrigger>
            <CheckIcon className="size-5 text-green-500" />
          </TooltipTrigger>
          <TooltipContent side="right">Service is available</TooltipContent>
        </Tooltip>
      ) : null}
    </TooltipProvider>
  );
};

const formSchema = z.object({
  endpoint: z
    .string({
      required_error: 'Please provide an endpoint',
    })
    .url({
      message: 'Invalid URL',
    }),
  secret: z
    .string({
      required_error: 'Please provide a secret',
    })
    .min(2, 'Too short')
    .max(256, 'Max 256 characters long'),
});

type FormValues = z.infer<typeof formSchema>;

const ExternalCompositionForm = ({
  endpoint,
  ...props
}: {
  project: FragmentType<typeof ExternalCompositionForm_ProjectFragment>;
  organization: FragmentType<typeof ExternalCompositionForm_OrganizationFragment>;
  endpoint?: string;
}) => {
  const project = useFragment(ExternalCompositionForm_ProjectFragment, props.project);
  const organization = useFragment(
    ExternalCompositionForm_OrganizationFragment,
    props.organization,
  );
  const notify = useNotifications();
  const [mutation, enable] = useMutation(ExternalCompositionForm_EnableMutation);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      endpoint: endpoint ?? '',
      secret: '',
    },
    disabled: mutation.fetching,
  });

  function onSubmit(values: FormValues) {
    void enable({
      input: {
        projectSlug: project.slug,
        organizationSlug: organization.slug,
        endpoint: values.endpoint,
        secret: values.secret,
      },
    }).then(result => {
      if (result.data?.enableExternalSchemaComposition?.ok) {
        notify('External composition enabled', 'success');
        const endpoint =
          result.data?.enableExternalSchemaComposition?.ok.externalSchemaComposition?.endpoint;

        if (endpoint) {
          form.reset(
            {
              endpoint,
              secret: '',
            },
            {
              keepDirty: false,
              keepDirtyValues: false,
            },
          );
        }
      } else {
        const error =
          result.error?.message || result.data?.enableExternalSchemaComposition.error?.message;

        if (error) {
          notify(error, 'error');
        }

        const inputErrors = result.data?.enableExternalSchemaComposition.error?.inputErrors;

        if (inputErrors?.endpoint) {
          form.setError('endpoint', {
            type: 'manual',
            message: inputErrors.endpoint,
          });
        }

        if (inputErrors?.secret) {
          form.setError('secret', {
            type: 'manual',
            message: inputErrors.secret,
          });
        }
      }
    });
  }

  return (
    <div className="flex justify-between">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="endpoint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HTTP Endpoint</FormLabel>
                <FormDescription>A POST request will be sent to that endpoint</FormDescription>
                <div className="flex w-full max-w-sm items-center space-x-2">
                  <FormControl>
                    <Input
                      className="w-96 shrink-0"
                      placeholder="Endpoint"
                      type="text"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  {!form.formState.isDirty &&
                  (endpoint ||
                    mutation.data?.enableExternalSchemaComposition.ok?.externalSchemaComposition
                      ?.endpoint) ? (
                    <ExternalCompositionStatus
                      projectSlug={project.slug}
                      organizationSlug={organization.slug}
                    />
                  ) : null}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Secret</FormLabel>
                <FormDescription>
                  The secret is needed to sign and verify the request.
                </FormDescription>
                <FormControl>
                  <Input
                    className="w-96"
                    placeholder="Secret"
                    type="password"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {mutation.error && (
            <div className="mt-2 text-xs text-red-500">{mutation.error.message}</div>
          )}
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

const ExternalComposition_DisableMutation = graphql(`
  mutation ExternalComposition_DisableMutation($input: DisableExternalSchemaCompositionInput!) {
    disableExternalSchemaComposition(input: $input) {
      ok {
        id
        isNativeFederationEnabled
        externalSchemaComposition {
          endpoint
        }
      }
      error
    }
  }
`);

const ExternalComposition_ProjectConfigurationQuery = graphql(`
  query ExternalComposition_ProjectConfigurationQuery($selector: ProjectSelectorInput!) {
    project(selector: $selector) {
      id
      slug
      isNativeFederationEnabled
      externalSchemaComposition {
        endpoint
      }
    }
  }
`);

const ExternalCompositionSettings_OrganizationFragment = graphql(`
  fragment ExternalCompositionSettings_OrganizationFragment on Organization {
    slug
    ...ExternalCompositionForm_OrganizationFragment
  }
`);

const ExternalCompositionSettings_ProjectFragment = graphql(`
  fragment ExternalCompositionSettings_ProjectFragment on Project {
    slug
    isNativeFederationEnabled
    ...ExternalCompositionForm_ProjectFragment
  }
`);

export const ExternalCompositionSettings = (props: {
  project: FragmentType<typeof ExternalCompositionSettings_ProjectFragment>;
  organization: FragmentType<typeof ExternalCompositionSettings_OrganizationFragment>;
}) => {
  const project = useFragment(ExternalCompositionSettings_ProjectFragment, props.project);
  const organization = useFragment(
    ExternalCompositionSettings_OrganizationFragment,
    props.organization,
  );
  const [enabled, setEnabled] = useState<boolean>();
  const [mutation, disableComposition] = useMutation(ExternalComposition_DisableMutation);
  const notify = useNotifications();
  const [projectQuery] = useQuery({
    query: ExternalComposition_ProjectConfigurationQuery,
    variables: {
      selector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
      },
    },
  });

  const handleSwitch = useCallback(
    async (status: boolean) => {
      if (status) {
        setEnabled(true);
      } else {
        setEnabled(false);
        const result = await disableComposition({
          input: {
            projectSlug: project.slug,
            organizationSlug: organization.slug,
          },
        });
        const error = result.error?.message || result.data?.disableExternalSchemaComposition.error;
        if (error) {
          notify(error, 'error');
          // fallback to the previous state
          setEnabled(true);
        }
      }
    },
    [disableComposition, setEnabled, notify],
  );

  const externalCompositionConfig = projectQuery.data?.project?.externalSchemaComposition;
  const initialEnabled = !!externalCompositionConfig;
  const isEnabled = typeof enabled === 'boolean' ? enabled : initialEnabled;
  const isLoading = projectQuery.fetching || mutation.fetching;
  const isFormVisible = isEnabled && !isLoading;
  const isNativeCompositionEnabled = projectQuery.data?.project?.isNativeFederationEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>External Schema Composition</div>
          <div>
            {isLoading ? (
              <Spinner />
            ) : (
              <Switch
                className="shrink-0"
                checked={isEnabled}
                onCheckedChange={handleSwitch}
                disabled={mutation.fetching}
              />
            )}
          </div>
        </CardTitle>
        <CardDescription>
          <ProductUpdatesLink href="#native-composition">
            Enable native Apollo Federation v2 support in Hive
          </ProductUpdatesLink>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isNativeCompositionEnabled && isEnabled ? (
          <DocsNote warn className={isFormVisible ? 'mb-6 mt-0' : ''}>
            It appears that Native Federation v2 Composition is activated and will be used instead.
            <br />
            External composition won't have any effect.
          </DocsNote>
        ) : null}

        {isFormVisible ? (
          <ExternalCompositionForm
            project={project}
            organization={organization}
            endpoint={externalCompositionConfig?.endpoint}
          />
        ) : (
          <Button disabled={mutation.fetching} onClick={() => handleSwitch(true)}>
            Enable external composition
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
