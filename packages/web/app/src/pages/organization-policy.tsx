import { ReactElement } from 'react';
import { useMutation, useQuery } from 'urql';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { PolicySettings } from '@/components/policy/policy-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DocsLink, DocsNote } from '@/components/ui/docs-note';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { useToast } from '@/components/ui/use-toast';
import { graphql } from '@/gql';
import { OrganizationAccessScope, RegistryModel } from '@/gql/graphql';
import { useOrganizationAccess } from '@/lib/access/organization';

const OrganizationPolicyPageQuery = graphql(`
  query OrganizationPolicyPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        me {
          id
          ...CanAccessOrganization_MemberFragment
        }
        projects {
          nodes {
            id
            slug
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

function PolicyPageContent(props: { organizationSlug: string }) {
  const [query] = useQuery({
    query: OrganizationPolicyPageQuery,
    variables: {
      selector: {
        organizationSlug: props.organizationSlug,
      },
    },
  });
  const [mutation, mutate] = useMutation(UpdateSchemaPolicyForOrganization);
  const { toast } = useToast();

  const currentOrganization = query.data?.organization?.organization;

  const hasAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: currentOrganization?.me ?? null,
    redirect: true,
    organizationSlug: props.organizationSlug,
  });

  const legacyProjects = currentOrganization?.projects.nodes.filter(
    p => p.registryModel === RegistryModel.Legacy,
  );

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  return (
    <OrganizationLayout
      page={Page.Policy}
      organizationSlug={props.organizationSlug}
      className="flex flex-col gap-y-10"
    >
      <div>
        <div className="py-6">
          <Title>Organization Schema Policy</Title>
          <Subtitle>
            Schema Policies enable developers to define additional semantic checks on the GraphQL
            schema.
          </Subtitle>
        </div>
        {hasAccess && currentOrganization ? (
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
                        <code className="italic" key={p.slug}>
                          {p.slug}
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
                      organizationSlug: props.organizationSlug,
                    },
                    policy: newPolicy,
                    allowOverrides,
                  })
                    .then(result => {
                      if (result.data?.updateSchemaPolicyForOrganization.error || result.error) {
                        toast({
                          variant: 'destructive',
                          title: 'Error',
                          description:
                            result.data?.updateSchemaPolicyForOrganization.error?.message ||
                            result.error?.message,
                        });
                      } else {
                        toast({
                          variant: 'default',
                          title: 'Success',
                          description: 'Policy updated successfully',
                        });
                      }
                    })
                    .catch();
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

export function OrganizationPolicyPage(props: { organizationSlug: string }): ReactElement {
  return (
    <>
      <Meta title="Organization Schema Policy" />
      <PolicyPageContent organizationSlug={props.organizationSlug} />
    </>
  );
}
