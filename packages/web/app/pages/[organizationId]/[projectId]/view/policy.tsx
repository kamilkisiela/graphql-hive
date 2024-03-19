import { ReactElement } from 'react';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, ProjectLayout } from '@/components/layouts/project';
import { PolicySettings } from '@/components/policy/policy-settings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { DocsLink, MetaTitle } from '@/components/v2';
import { graphql } from '@/gql';
import { ProjectAccessScope } from '@/gql/graphql';
import { RegistryModel } from '@/graphql';
import { useProjectAccess } from '@/lib/access/project';
import { useRouteSelector } from '@/lib/hooks';

const ProjectPolicyPageQuery = graphql(`
  query ProjectPolicyPageQuery($organizationId: ID!, $projectId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        id
        schemaPolicy {
          id
          updatedAt
          allowOverrides
          rules {
            rule {
              id
            }
          }
        }
        me {
          id
          ...CanAccessProject_MemberFragment
        }
        ...ProjectLayout_CurrentOrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      id
      ...ProjectLayout_CurrentProjectFragment
      registryModel
      schemaPolicy {
        id
        updatedAt
        ...PolicySettings_SchemaPolicyFragment
      }
    }
    organizations {
      ...ProjectLayout_OrganizationConnectionFragment
    }
    me {
      id
      ...ProjectLayout_MeFragment
    }
  }
`);

const UpdateSchemaPolicyForProject = graphql(`
  mutation UpdateSchemaPolicyForProject(
    $selector: ProjectSelectorInput!
    $policy: SchemaPolicyInput!
  ) {
    updateSchemaPolicyForProject(selector: $selector, policy: $policy) {
      error {
        message
      }
      ok {
        project {
          id
          ...ProjectLayout_CurrentProjectFragment
          schemaPolicy {
            id
            updatedAt
            ...PolicySettings_SchemaPolicyFragment
          }
        }
      }
    }
  }
`);

function ProjectPolicyContent() {
  const [mutation, mutate] = useMutation(UpdateSchemaPolicyForProject);
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ProjectPolicyPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
    requestPolicy: 'cache-and-network',
  });

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;

  const hasAccess = useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: currentOrganization?.me ?? null,
    redirect: true,
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const isLegacyProject = currentProject?.registryModel === RegistryModel.Legacy;

  return (
    <ProjectLayout
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
      page={Page.Policy}
      className="flex flex-col gap-y-10"
    >
      <div>
        <div className="py-6">
          <Title>Project Schema Policy</Title>
          <Subtitle>
            Schema Policies enable developers to define additional semantic checks on the GraphQL
            schema.
          </Subtitle>
        </div>
        {currentProject && currentOrganization && hasAccess ? (
          <Card>
            <CardHeader>
              <CardTitle>Rules</CardTitle>
              {currentProject && isLegacyProject ? (
                <CardDescription>
                  <strong>
                    Policy feature is only available for projects that are using the new registry
                    model.
                    <br />
                    Please upgrade your project to use the new registry model if you wish to use the
                    policy feature.
                  </strong>
                  <br />
                  <DocsLink
                    className="text-muted-foreground text-sm"
                    href="https://the-guild.dev/blog/graphql-hive-improvements-in-schema-registry"
                  >
                    Learn more
                  </DocsLink>
                </CardDescription>
              ) : (
                <CardDescription>
                  At the project level, policies can be defined to affect all targets, and override
                  policy configuration defined at the organization level.
                  <br />
                  <DocsLink
                    href="/features/schema-policy"
                    className="text-muted-foreground text-sm"
                  >
                    Learn more
                  </DocsLink>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {currentOrganization.schemaPolicy === null ||
              currentOrganization.schemaPolicy?.allowOverrides ? (
                <PolicySettings
                  saving={mutation.fetching}
                  rulesInParent={currentOrganization.schemaPolicy?.rules.map(r => r.rule.id)}
                  error={
                    mutation.error?.message ||
                    mutation.data?.updateSchemaPolicyForProject.error?.message
                  }
                  onSave={async newPolicy => {
                    await mutate({
                      selector: {
                        organization: router.organizationId,
                        project: router.projectId,
                      },
                      policy: newPolicy,
                    });
                  }}
                  currentState={currentProject.schemaPolicy}
                />
              ) : (
                <div className="pl-1 text-sm font-bold text-gray-400">
                  <p className="mr-4 inline-block text-orange-500">!</p>
                  Organization settings does not allow projects to override policy. Please consult
                  your organization administrator.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ProjectLayout>
  );
}

function ProjectPolicyPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Project Schema Policy" />
      <ProjectPolicyContent />
    </>
  );
}

export default authenticated(ProjectPolicyPage);
