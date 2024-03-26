import { ReactElement } from 'react';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { PolicySettings } from '@/components/policy/policy-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { DocsLink, DocsNote, MetaTitle } from '@/components/v2';
import { graphql } from '@/gql';
import { OrganizationAccessScope } from '@/gql/graphql';
import { RegistryModel } from '@/graphql';
import { useOrganizationAccess } from '@/lib/access/organization';
import { useRouteSelector } from '@/lib/hooks';

const OrganizationPolicyPageQuery = graphql(`
  query OrganizationPolicyPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        ...OrganizationLayout_CurrentOrganizationFragment
        me {
          ...CanAccessOrganization_MemberFragment
        }
        projects {
          nodes {
            id
            cleanId
            registryModel
          }
        }
        schemaPolicy {
          id
          updatedAt
          ...PolicySettings_SchemaPolicyFragment
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
          ...OrganizationLayout_CurrentOrganizationFragment
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

function PolicyPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: OrganizationPolicyPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });
  const [mutation, mutate] = useMutation(UpdateSchemaPolicyForOrganization);

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;

  const hasAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: currentOrganization?.me ?? null,
    redirect: true,
  });

  if (!hasAccess) {
    return null;
  }

  const legacyProjects = currentOrganization?.projects.nodes.filter(
    p => p.registryModel === RegistryModel.Legacy,
  );

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  return (
    <OrganizationLayout
      page={Page.Policy}
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
    >
      <div>
        <div className="py-6">
          <Title>Organization Schema Policy</Title>
          <Subtitle>
            Schema Policies enable developers to define additional semantic checks on the GraphQL
            schema.
          </Subtitle>
        </div>
        {currentOrganization ? (
          <Card>
            <CardHeader>
              <CardTitle>Rules</CardTitle>
              <CardDescription>
                At the organizational level, policies can be defined to affect all projects and
                targets.
                <br />
                At the project level, policies can be overridden or extended.
                <br />
                <DocsLink className="text-muted-foreground" href="/features/schema-policy">
                  Learn more
                </DocsLink>
              </CardDescription>
            </CardHeader>
            {legacyProjects && legacyProjects.length > 0 ? (
              <div className="p-6">
                <DocsNote warn>
                  <p>Some of your projects are using the legacy model of the schema registry.</p>
                  <p className="text-muted-foreground">
                    {legacyProjects.map((p, i, all) => (
                      <>
                        <code className="italic" key={p.cleanId}>
                          {p.cleanId}
                        </code>
                        {all.length === i - 1 ? ' ' : ', '}
                      </>
                    ))}
                  </p>
                  <p className="text-muted-foreground py-2 font-semibold underline">
                    Policy feature is only available for projects that are using the new registry
                    model.
                  </p>
                  <p>
                    <DocsLink
                      className="text-muted-foreground"
                      href="https://the-guild.dev/blog/graphql-hive-improvements-in-schema-registry"
                    >
                      Learn more
                    </DocsLink>
                  </p>
                </DocsNote>
              </div>
            ) : null}
            <CardContent>
              <PolicySettings
                saving={mutation.fetching}
                error={
                  mutation.error?.message ||
                  mutation.data?.updateSchemaPolicyForOrganization.error?.message
                }
                onSave={async (newPolicy, allowOverrides) => {
                  await mutate({
                    selector: {
                      organization: router.organizationId,
                    },
                    policy: newPolicy,
                    allowOverrides,
                  }).catch();
                }}
                currentState={currentOrganization.schemaPolicy}
              >
                {form => (
                  <div className="flex items-center pl-1 pt-2">
                    <Checkbox
                      id="allowOverrides"
                      checked={form.values.allowOverrides}
                      value="allowOverrides"
                      onCheckedChange={newValue => form.setFieldValue('allowOverrides', newValue)}
                    />
                    <label
                      htmlFor="allowOverrides"
                      className="ml-2 inline-block text-sm text-gray-300"
                    >
                      Allow projects to override or disable rules
                    </label>
                  </div>
                )}
              </PolicySettings>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </OrganizationLayout>
  );
}

function OrganizationPolicyPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Organization Schema Policy" />
      <PolicyPageContent />
    </>
  );
}

export default authenticated(OrganizationPolicyPage);
