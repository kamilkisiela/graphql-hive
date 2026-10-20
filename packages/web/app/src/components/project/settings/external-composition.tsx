import { useEffect, useState } from 'react';
import { Check, RefreshCw, RotateCw, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { CombinedError, useQuery } from 'urql';
import { ProductUpdatesLink } from '@/components/ui/docs-note';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import { UpdateSchemaCompositionInput } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ExternalCompositionForm,
  ExternalCompositionFormSchema,
  type ExternalCompositionFormValues,
} from './external-composition-form';
import * as styles from './external-composition.css';

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

const ExternalCompositionSettings_OrganizationFragment = graphql(`
  fragment ExternalCompositionSettings_OrganizationFragment on Organization {
    id
    slug
  }
`);

const ExternalCompositionSettings_ProjectFragment = graphql(`
  fragment ExternalCompositionSettings_ProjectFragment on Project {
    id
    slug
    isNativeFederationEnabled
    externalSchemaComposition {
      endpoint
    }
  }
`);

const ExternalCompositionSettings_UpdateResultFragment = graphql(`
  fragment ExternalCompositionSettings_UpdateResultFragment on UpdateSchemaCompositionResult {
    ok {
      updatedProject {
        id
        externalSchemaComposition {
          endpoint
        }
      }
    }
    error {
      message
      ... on UpdateSchemaCompositionExternalError {
        inputErrors {
          endpoint
          secret
        }
      }
    }
  }
`);

enum TestState {
  LOADING,
  ERROR,
  SUCCESS,
}

const ExternalCompositionStatus = () => {
  const { organizationSlug, projectSlug } = useSlugs('project');
  const [{ data, error: gqlError, fetching }, executeTestQuery] = useQuery({
    query: ExternalCompositionStatus_TestQuery,
    variables: {
      selector: {
        projectSlug,
        organizationSlug,
      },
    },
    requestPolicy: 'network-only',
  });
  const error = gqlError?.message ?? data?.testExternalSchemaComposition?.error?.message;
  const testState = fetching
    ? TestState.LOADING
    : error
      ? TestState.ERROR
      : data?.testExternalSchemaComposition?.ok?.externalSchemaComposition?.endpoint
        ? TestState.SUCCESS
        : null;

  const [hidden, setHidden] = useState<boolean>();

  useEffect(() => {
    // only hide the success icon after the duration
    if (testState !== TestState.SUCCESS) return;
    const timerId = setTimeout(() => {
      if (testState === TestState.SUCCESS) {
        setHidden(false);
      }
    }, 5000);

    return () => {
      clearTimeout(timerId);
    };
  }, [testState]);

  return (
    <>
      {testState === TestState.LOADING ? (
        <Tooltip
          trigger={
            <span className={styles.externalCompositionStatusSpan}>
              <RefreshCw
                className={styles.externalCompositionStatusRefreshCw}
                onClick={e => e.preventDefault()}
              />
            </span>
          }
          content="Connecting..."
          side="bottom"
        />
      ) : (
        <Tooltip
          trigger={
            <button
              type="button"
              aria-label="Execute test"
              onClick={e => {
                e.preventDefault();
                setHidden(true);
                executeTestQuery();
              }}
            >
              <RotateCw className={styles.externalCompositionStatusRotateCw} />
            </button>
          }
          content="Execute test"
          side="bottom"
        />
      )}
      {testState === TestState.ERROR ? (
        <Tooltip
          defaultOpen
          trigger={
            <span className={styles.externalCompositionStatusSpan2}>
              <X className={styles.externalCompositionStatusX} onClick={e => e.preventDefault()} />
            </span>
          }
          content={error}
          side="bottom"
          maxWidth="md"
        />
      ) : null}
      {testState === TestState.SUCCESS && !hidden ? (
        <Tooltip
          trigger={
            <span className={styles.externalCompositionStatusSpan3}>
              <Check
                className={styles.externalCompositionStatusCheck}
                onClick={e => e.preventDefault()}
              />
            </span>
          }
          content="Service is available"
          side="bottom"
          maxWidth="md"
        />
      ) : null}
    </>
  );
};

export const ExternalCompositionSettings = (props: {
  project: FragmentType<typeof ExternalCompositionSettings_ProjectFragment>;
  organization: FragmentType<typeof ExternalCompositionSettings_OrganizationFragment>;
  activeCompositionMode: 'native' | 'external' | 'legacy';
  onMutate: (
    input: UpdateSchemaCompositionInput,
  ) => Promise<
    FragmentType<typeof ExternalCompositionSettings_UpdateResultFragment> | CombinedError
  >;
}) => {
  const project = useFragment(ExternalCompositionSettings_ProjectFragment, props.project);
  const organization = useFragment(
    ExternalCompositionSettings_OrganizationFragment,
    props.organization,
  );
  const { toast } = useToast();
  const [error, setError] = useState<string>();
  const [isMutating, setIsMutating] = useState(false);

  const form = useForm<ExternalCompositionFormValues>({
    resolver: zodResolver(ExternalCompositionFormSchema),
    mode: 'onChange',
    defaultValues: {
      endpoint: project.externalSchemaComposition?.endpoint ?? '',
      secret: '',
    },
    disabled: isMutating,
  });

  function onSubmit(values: ExternalCompositionFormValues) {
    setError(undefined);
    setIsMutating(true);
    void props
      .onMutate({
        project: {
          bySelector: {
            projectSlug: project.slug,
            organizationSlug: organization.slug,
          },
        },
        method: {
          external: {
            endpoint: values.endpoint,
            secret: values.secret,
          },
        },
      })
      .then(result => {
        setIsMutating(false);
        if (result instanceof CombinedError) {
          toast({ variant: 'destructive', title: result.message });
          setError(result.message);
        } else {
          // actually not a hook
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const updateResult = useFragment(
            ExternalCompositionSettings_UpdateResultFragment,
            result,
          );
          if (updateResult.ok) {
            const endpoint = updateResult.ok.updatedProject.externalSchemaComposition?.endpoint;

            toast({ title: 'External composition enabled.' });

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
          } else if (updateResult.error) {
            toast({ variant: 'destructive', title: updateResult.error.message });
            setError(updateResult.error.message);

            if (updateResult.error.__typename === 'UpdateSchemaCompositionExternalError') {
              if (updateResult.error.inputErrors?.endpoint) {
                form.setError('endpoint', {
                  type: 'manual',
                  message: updateResult.error.inputErrors.endpoint,
                });
              }

              if (updateResult.error.inputErrors?.secret) {
                form.setError('secret', {
                  type: 'manual',
                  message: updateResult.error.inputErrors.secret,
                });
              }
            }
          }
        }
      });
  }

  return (
    <div className={styles.externalCompositionSettingsDiv}>
      <div>
        <p className={styles.externalCompositionSettingsP}>
          For advanced users, you can configure an endpoint for external schema compositions. This
          can be used to implement custom composition logic.
        </p>
        <ProductUpdatesLink
          href="https://the-guild.dev/graphql/hive/docs/features/external-schema-composition"
          text="Read about external schema composition in our documentation."
        />
      </div>
      <div className={styles.externalCompositionSettingsDiv2}>
        <ExternalCompositionForm
          form={form}
          onSubmit={onSubmit}
          endpointStatus={
            project.externalSchemaComposition?.endpoint ? <ExternalCompositionStatus /> : null
          }
          error={error}
          submitLabel={
            props.activeCompositionMode === 'external'
              ? 'Save Configuration'
              : 'Use External Composition'
          }
        />
      </div>
    </div>
  );
};
