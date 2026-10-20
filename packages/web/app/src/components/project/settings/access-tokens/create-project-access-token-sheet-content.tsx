import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'urql';
import { Heading } from '@/components/ui/heading';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';
import { Form } from '@/components/ui/primitives/form/form';
import { Sheet } from '@/components/ui/primitives/overlays/sheet/sheet';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { defineStepper } from '@/components/ui/stepper';
import { FragmentType, graphql, useFragment } from '@/gql';
import * as GraphQLSchema from '@/gql/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { PermissionSelector } from '../../../organization/members/permission-selector';
import {
  ResourceSelector,
  resourceSlectionToGraphQLSchemaResourceAssignmentInput,
  type ResourceSelection,
} from '../../../organization/members/resource-selector';
import { SelectedPermissionOverview } from '../../../organization/members/selected-permission-overview';
import {
  AccessTokenFormSchema,
  AccessTokenGeneralStep,
  AccessTokenPermissionsStep,
  type AccessTokenFormValues,
} from '../../../organization/settings/access-tokens/access-token-form';
import {
  permissionLevelToResourceName,
  resolveResources,
} from '../../../organization/settings/access-tokens/shared-helpers';
import * as styles from './create-project-access-token-sheet-content.css';

const CreateProjectAccessTokenSheetContent_OrganizationFragment = graphql(`
  fragment CreateProjectAccessTokenSheetContent_OrganizationFragment on Organization {
    id
    slug
    ...ResourceSelector_OrganizationFragment
  }
`);

const CreateProjectAccessTokenSheetContent_ProjectFragment = graphql(`
  fragment CreateProjectAccessTokenSheetContent_ProjectFragment on Project {
    id
    slug
    availableProjectAccessTokenPermissionGroups {
      ...PermissionSelector_PermissionGroupsFragment
      ...SelectedPermissionOverview_PermissionGroupFragment
    }
  }
`);

type CreateProjectAccessTokenSheetContentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  /** Called with the new token's key; the caller closes the sheet and shows the key. */
  onSuccess: (privateAccessKey: string) => void;
  organization: FragmentType<typeof CreateProjectAccessTokenSheetContent_OrganizationFragment>;
  project: FragmentType<typeof CreateProjectAccessTokenSheetContent_ProjectFragment>;
};

const CreateProjectAccessTokenSheetContent_CreateOrganizationAccessTokenMutation = graphql(`
  mutation CreateProjectAccessTokenSheetContent_CreateOrganizationAccessTokenMutation(
    $input: CreateProjectAccessTokenInput!
  ) {
    createProjectAccessToken(input: $input) {
      ok {
        privateAccessKey
        createdProjectAccessToken {
          id
        }
      }
      error {
        message
        details {
          title
          description
        }
      }
    }
  }
`);

export function CreateProjectAccessTokenSheetContent(
  props: CreateProjectAccessTokenSheetContentProps,
): React.ReactNode {
  // eslint-disable-next-line react/hook-use-state
  const [Stepper] = useState(() =>
    defineStepper(
      {
        id: 'step-1-general',
        title: 'General',
      },
      {
        id: 'step-2-permissions',
        title: 'Permissions',
      },
      {
        id: 'step-3-resources',
        title: 'Resources',
      },
      {
        id: 'step-4-confirmation',
        title: 'Confirm',
      },
    ),
  );
  const organization = useFragment(
    CreateProjectAccessTokenSheetContent_OrganizationFragment,
    props.organization,
  );
  const project = useFragment(CreateProjectAccessTokenSheetContent_ProjectFragment, props.project);
  const [resourceSelection, setResourceSelection] = useState<ResourceSelection>(() => ({
    mode: GraphQLSchema.ResourceAssignmentModeType.Granular,
    projects: [
      {
        projectId: project.id,
        projectSlug: project.slug,
        targets: {
          mode: GraphQLSchema.ResourceAssignmentModeType.All,
          targets: [],
        },
      },
    ],
  }));

  const form = useForm<AccessTokenFormValues>({
    mode: 'onChange',
    resolver: zodResolver(AccessTokenFormSchema),
    defaultValues: {
      title: '',
      description: '',
      permissions: [],
      expirationPeriod: GraphQLSchema.TokenExpirationPeriod.Never,
    },
  });

  const [createOrganizationAccessTokenState, createOrganizationAccessToken] = useMutation(
    CreateProjectAccessTokenSheetContent_CreateOrganizationAccessTokenMutation,
  );

  const resolvedResources = useMemo(
    () => resolveResources(organization.slug, resourceSelection),
    [resourceSelection],
  );

  const { toast } = useToast();
  async function createAccessToken() {
    const formValues = form.getValues();
    const result = await createOrganizationAccessToken({
      input: {
        project: {
          byId: project.id,
        },
        title: formValues.title ?? '',
        description: formValues.description ?? '',
        permissions: formValues.permissions,
        resources: resourceSlectionToGraphQLSchemaResourceAssignmentInput(
          resourceSelection,
        ).projects?.at(0)?.targets ?? {
          mode: GraphQLSchema.ResourceAssignmentModeType.Granular,
          targets: [],
        },
        expirationPeriod: formValues.expirationPeriod,
      },
    });

    if (result.data?.createProjectAccessToken.error) {
      const { error } = result.data.createProjectAccessToken;
      if (error.details?.title) {
        form.setError('title', { message: error.details.title });
      }
      if (error.details?.description) {
        form.setError('description', { message: error.details.description });
      }
      if (error.message) {
        toast({
          variant: 'destructive',
          title: 'An error occurred',
          description: error.message,
        });
      }
      return;
    }
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: 'Something went wrong. Try again later.',
      });
      return;
    }
    if (result.data?.createProjectAccessToken.ok) {
      props.onSuccess(result.data.createProjectAccessToken.ok.privateAccessKey);
    }
  }

  return (
    <Stepper.StepperProvider variant="horizontal">
      {({ stepper }) => (
        <Sheet
          open={props.open}
          onOpenChange={props.onOpenChange}
          onOpenChangeComplete={props.onOpenChangeComplete}
          title="Create Access Token"
          description="Create a new access token with specified permissions and optionally assigned resources."
          footer={
            <Stepper.StepperControls>
              <Button
                variant="outline"
                onClick={() => void stepper.prev()}
                disabled={stepper.isFirst || createOrganizationAccessTokenState.fetching}
              >
                Go back
              </Button>
              {stepper.isLast ? (
                <Button
                  onSurface="raised"
                  onClick={
                    createOrganizationAccessTokenState.fetching ? undefined : createAccessToken
                  }
                >
                  {createOrganizationAccessTokenState.fetching
                    ? 'Creating...'
                    : 'Create Access Token'}
                </Button>
              ) : (
                <Button
                  onSurface="raised"
                  onClick={ev => {
                    if (stepper.current.id === 'step-1-general') {
                      void Promise.all([form.trigger('title'), form.trigger('description')]).then(
                        ([title, description]) => {
                          if (!title) {
                            shakeElement(ev);
                            form.setFocus('title');
                            return;
                          }
                          if (!description) {
                            shakeElement(ev);
                            form.setFocus('description');
                            return;
                          }
                          void stepper.next();
                        },
                      );
                    }

                    if (stepper.current.id === 'step-2-permissions') {
                      void form.trigger('permissions').then(permissions => {
                        if (!permissions) {
                          shakeElement(ev);
                          return;
                        }

                        void stepper.next();
                      });
                    }

                    if (stepper.current.id === 'step-3-resources') {
                      void stepper.next();
                    }
                  }}
                >
                  Next
                </Button>
              )}
            </Stepper.StepperControls>
          }
        >
          <Form form={form} onSubmit={() => {}}>
            <Stepper.StepperNavigation>
              {stepper.steps.map(step => (
                <Stepper.StepperStep key={step.id} of={step.id} clickable={false}>
                  <Stepper.StepperTitle>{step.title}</Stepper.StepperTitle>
                </Stepper.StepperStep>
              ))}
            </Stepper.StepperNavigation>
            {stepper.match({
              'step-1-general': () => <AccessTokenGeneralStep form={form} />,
              'step-2-permissions': () => (
                <AccessTokenPermissionsStep form={form}>
                  <PermissionSelector
                    onSurface="raised"
                    permissionGroups={project.availableProjectAccessTokenPermissionGroups}
                    selectedPermissionIds={new Set(form.getValues()['permissions'])}
                    onSelectedPermissionsChange={selectedPermissionIds => {
                      form.setValue('permissions', Array.from(selectedPermissionIds), {
                        shouldValidate: true,
                        shouldTouch: true,
                        shouldDirty: true,
                      });
                    }}
                  />
                </AccessTokenPermissionsStep>
              ),
              'step-3-resources': () => (
                <>
                  <Heading>Resource Access</Heading>
                  <ResourceSelector
                    organization={organization}
                    selection={resourceSelection}
                    onSelectionChange={setResourceSelection}
                    forProjectId={project.id}
                    intent={GraphQLSchema.ResourceSelectorIntentType.User}
                  />
                </>
              ),
              'step-4-confirmation': () => (
                <>
                  <Heading>Confirm and create Access Token</Heading>
                  <p className={styles.createProjectAccessTokenSheetContentP}>
                    Please please review the selected permissions and resources to ensure they align
                    with your intended access needs.
                  </p>
                  {form.getValues().permissions.length === 0 ? (
                    <p className={styles.createProjectAccessTokenSheetContentP2}>
                      No permissions are selected.
                    </p>
                  ) : (
                    <SelectedPermissionOverview
                      activePermissionIds={form.getValues().permissions}
                      permissionsGroups={project.availableProjectAccessTokenPermissionGroups}
                      showOnlyAllowedPermissions
                      isExpanded
                      additionalGroupContent={group => (
                        <div className={styles.createProjectAccessTokenSheetContentDiv}>
                          {resolvedResources === null ? (
                            <>Granted on all {permissionLevelToResourceName(group.level)}</>
                          ) : (
                            <>
                              <p className={styles.createProjectAccessTokenSheetContentP3}>
                                Granted on {permissionLevelToResourceName(group.level)}:
                              </p>
                              <ul className={styles.createProjectAccessTokenSheetContentUl}>
                                {!resolvedResources[group.level]?.length && (
                                  <li>
                                    <Badge
                                      content={`No ${group.level} selected.`}
                                      variants={{ variant: 'critical', mono: true }}
                                    />
                                  </li>
                                )}
                                {resolvedResources[group.level].map(id => (
                                  <li key={id}>
                                    <Badge
                                      content={id}
                                      variants={{ variant: 'outline', mono: true }}
                                    />
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    />
                  )}
                </>
              ),
            })}
          </Form>
        </Sheet>
      )}
    </Stepper.StepperProvider>
  );
}

function shakeElement(ev: React.MouseEvent<HTMLElement>) {
  const el = ev.target as HTMLElement;
  el.classList.add('animate-shake');
  el.addEventListener(
    'animationend',
    () => {
      el.classList.remove('animate-shake');
    },
    { once: true },
  );
}
