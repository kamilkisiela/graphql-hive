import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { gql, useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import { OIDCIntegrationSection } from '@/components/organization/settings/oidc-integration-section';
import { Button, Card, Heading, Input, Spinner, Tag, Title } from '@/components/v2';
import { AlertTriangleIcon, GitHubIcon, SlackIcon } from '@/components/v2/icon';
import {
  DeleteOrganizationModal,
  TransferOrganizationOwnershipModal,
} from '@/components/v2/modals';
import { env } from '@/env/frontend';
import {
  CheckIntegrationsDocument,
  DeleteGitHubIntegrationDocument,
  DeleteSlackIntegrationDocument,
  OrganizationFieldsFragment,
  OrganizationType,
} from '@/graphql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';

const Integrations = (): ReactElement => {
  const router = useRouteSelector();
  const orgId = router.organizationId;

  const [checkIntegrations] = useQuery({
    query: CheckIntegrationsDocument,
    variables: {
      selector: {
        organization: orgId,
      },
    },
  });

  const [deleteSlackMutation, deleteSlack] = useMutation(DeleteSlackIntegrationDocument);
  const [deleteGitHubMutation, deleteGitHub] = useMutation(DeleteGitHubIntegrationDocument);

  if (checkIntegrations.fetching) {
    return <Spinner />;
  }

  const isGitHubIntegrationFeatureEnabled =
    checkIntegrations.data?.isGitHubIntegrationFeatureEnabled;
  const hasGitHubIntegration = checkIntegrations.data?.hasGitHubIntegration === true;
  const hasSlackIntegration = checkIntegrations.data?.hasSlackIntegration === true;

  return (
    <>
      {env.integrations.slack === false ? null : (
        <div className="flex items-center gap-x-4">
          {hasSlackIntegration ? (
            <Button
              size="large"
              danger
              disabled={deleteSlackMutation.fetching}
              onClick={async () => {
                await deleteSlack({
                  input: {
                    organization: orgId,
                  },
                });
              }}
            >
              <SlackIcon className="mr-2" />
              Disconnect Slack
            </Button>
          ) : (
            <Button variant="secondary" size="large" as="a" href={`/api/slack/connect/${orgId}`}>
              <SlackIcon className="mr-2" />
              Connect Slack
            </Button>
          )}
          <Tag>Alerts and notifications</Tag>
        </div>
      )}
      {isGitHubIntegrationFeatureEnabled === false ? null : (
        <div className="flex items-center gap-x-4">
          <>
            {hasGitHubIntegration ? (
              <>
                <Button
                  size="large"
                  danger
                  disabled={deleteGitHubMutation.fetching}
                  onClick={async () => {
                    await deleteGitHub({
                      input: {
                        organization: orgId,
                      },
                    });
                  }}
                >
                  <GitHubIcon className="mr-2" />
                  Disconnect GitHub
                </Button>
                <Button size="large" variant="link" as="a" href={`/api/github/connect/${orgId}`}>
                  Adjust permissions
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="large" as="a" href={`/api/github/connect/${orgId}`}>
                <GitHubIcon className="mr-2" />
                Connect GitHub
              </Button>
            )}
            <Tag>Allow Hive to communicate with GitHub</Tag>
          </>
        </div>
      )}
      {checkIntegrations.data?.organization?.organization.viewerCanManageOIDCIntegration ? (
        <OIDCIntegrationSection organization={checkIntegrations.data?.organization?.organization} />
      ) : null}
    </>
  );
};

const UpdateOrganizationNameMutation = gql(/* GraphQL */ `
  mutation Settings_UpdateOrganizationName($input: UpdateOrganizationNameInput!) {
    updateOrganizationName(input: $input) {
      ok {
        updatedOrganizationPayload {
          selector {
            organization
          }
          organization {
            ...OrganizationFields
          }
        }
      }
      error {
        message
      }
    }
  }
`);

const Page = ({ organization }: { organization: OrganizationFieldsFragment }) => {
  useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization.me,
    redirect: true,
  });
  const router = useRouteSelector();
  const isRegularOrg = organization?.type === OrganizationType.Regular;
  const [isDeleteModalOpen, toggleDeleteModalOpen] = useToggle();
  const [isTransferModalOpen, toggleTransferModalOpen] = useToggle();

  const [mutation, mutate] = useMutation(UpdateOrganizationNameMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        name: organization?.name,
      },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Organization name is required'),
      }),
      onSubmit: values =>
        mutate({
          input: {
            organization: router.organizationId,
            name: values.name,
          },
        }).then(result => {
          if (result.data?.updateOrganizationName?.ok) {
            const newOrgId =
              result.data?.updateOrganizationName?.ok.updatedOrganizationPayload.selector
                .organization;
            void router.replace(`/${newOrgId}/settings`);
          }
        }),
    });

  return (
    <>
      {isRegularOrg && (
        <Card>
          <Heading className="mb-2">Organization Name</Heading>
          <p className="mb-3 font-light text-gray-300">
            Name of your organization visible within Hive
          </p>
          <form onSubmit={handleSubmit} className="flex gap-x-2">
            <Input
              placeholder="Organization name"
              name="name"
              value={values.name}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              isInvalid={touched.name && !!errors.name}
              className="w-96"
            />
            <Button
              type="submit"
              variant="primary"
              size="large"
              disabled={isSubmitting}
              className="px-10"
            >
              Save
            </Button>
          </form>
          {touched.name && (errors.name || mutation.error) && (
            <div className="mt-2 text-red-500">{errors.name || mutation.error?.message}</div>
          )}
          {mutation.data?.updateOrganizationName?.error && (
            <div className="mt-2 text-red-500">
              {mutation.data?.updateOrganizationName.error.message}
            </div>
          )}
          {mutation.error && (
            <div>{mutation.error.graphQLErrors[0]?.message ?? mutation.error.message}</div>
          )}
        </Card>
      )}

      {canAccessOrganization(OrganizationAccessScope.Integrations, organization.me) && (
        <Card>
          <Heading className="mb-2">Integrations</Heading>
          <p className="mb-3 font-light text-gray-300">Connect Hive to other services</p>
          <div className="flex flex-col gap-y-4 text-gray-500">
            <Integrations />
          </div>
        </Card>
      )}

      {isRegularOrg && organization.me.isOwner && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Heading className="mb-2">Transfer Ownership</Heading>
              <p className="font-light text-gray-300">Transfer this organization to another user</p>
            </div>
            <div>
              <Button
                variant="primary"
                size="large"
                danger
                onClick={toggleTransferModalOpen}
                className="px-5"
              >
                Transfer
              </Button>
              <TransferOrganizationOwnershipModal
                isOpen={isTransferModalOpen}
                toggleModalOpen={toggleTransferModalOpen}
                organization={organization}
              />
            </div>
          </div>
        </Card>
      )}

      {isRegularOrg && canAccessOrganization(OrganizationAccessScope.Delete, organization.me) && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Heading className="mb-2">Delete Organization</Heading>
              <p className="font-light text-gray-300">Permanently remove your organization</p>
            </div>
            <div className="flex items-center gap-x-2">
              <Tag color="yellow" className="py-2.5 px-4">
                <AlertTriangleIcon className="h-5 w-5" />
                This action is not reversible!
              </Tag>
              <Button
                variant="primary"
                size="large"
                danger
                onClick={toggleDeleteModalOpen}
                className="px-5"
              >
                Delete Organization
              </Button>
              <DeleteOrganizationModal
                isOpen={isDeleteModalOpen}
                toggleModalOpen={toggleDeleteModalOpen}
                organization={organization}
              />
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

function SettingsPage(): ReactElement {
  return (
    <>
      <Title title="Organization settings" />
      <OrganizationLayout value="settings" className="flex flex-col gap-y-10">
        {props => <Page {...props} />}
      </OrganizationLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SettingsPage);
