import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import { PolicySettings } from '@/components/policy/policy-settings';
import { Card, Checkbox, DocsLink, DocsNote, Heading, Title } from '@/components/v2';
import { graphql } from '@/gql';
import { withSessionProtection } from '@/lib/supertokens/guard';

const OrganizationPolicyPageQuery = graphql(`
  query OrganizationPolicyPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        ...OrganizationLayout_OrganizationFragment
        schemaPolicy {
          id
          updatedAt
          ...PolicySettings_SchemaPolicyFragment
        }
      }
    }
  }
`);

const UpdateSchemaPolicyForOrganization = graphql(`
  mutation UpdateSchemaPolicyForOrganization(
    $selector: OrganizationSelectorInput!
    $policy: SchemaPolicyInput!
    $allowOverrides: Boolean!
  ) {
    updateSchemaPolicyForOrganization(
      selector: $selector
      policy: $policy
      allowOverrides: $allowOverrides
    ) {
      error {
        message
      }
      ok {
        organization {
          id
          ...OrganizationLayout_OrganizationFragment
          schemaPolicy {
            id
            updatedAt
            allowOverrides
            ...PolicySettings_SchemaPolicyFragment
          }
        }
      }
    }
  }
`);

function OrganizationPolicyPage(): ReactElement {
  const [mutation, mutate] = useMutation(UpdateSchemaPolicyForOrganization);

  return (
    <>
      <Title title="Organization Schema Policy" />
      <OrganizationLayout
        value="policy"
        className="flex flex-col gap-y-10"
        query={OrganizationPolicyPageQuery}
      >
        {(props, selector) =>
          props.organization ? (
            <Card>
              <Heading className="mb-2">Organization Schema Policy</Heading>
              <DocsNote>
                <strong>Schema Policies</strong> enable developers to define additional semantic
                checks on the GraphQL schema. At the organizational level, policies can be defined
                to affect all projects and targets. At the project level, policies can be overridden
                or extended. <DocsLink href="/features/schema-policy">Learn more</DocsLink>
              </DocsNote>
              <PolicySettings
                saving={mutation.fetching}
                error={
                  mutation.error?.message ||
                  mutation.data?.updateSchemaPolicyForOrganization.error?.message
                }
                onSave={async (newPolicy, allowOverrides) => {
                  await mutate({
                    selector,
                    policy: newPolicy,
                    allowOverrides,
                  }).catch();
                }}
                currentState={props.organization.organization.schemaPolicy}
              >
                {form => (
                  <div className="flex pl-1 pt-2">
                    <Checkbox
                      id="allowOverrides"
                      checked={form.values.allowOverrides}
                      value="allowOverrides"
                      onCheckedChange={newValue => form.setFieldValue('allowOverrides', newValue)}
                    />
                    <label
                      htmlFor="allowOverrides"
                      className="inline-block ml-2 text-sm text-gray-300"
                    >
                      Allow projects to override or disable rules
                    </label>
                  </div>
                )}
              </PolicySettings>
            </Card>
          ) : null
        }
      </OrganizationLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OrganizationPolicyPage);
