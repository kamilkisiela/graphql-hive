import { ReactElement } from 'react';
import { useMutation } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { ProjectLayout } from '@/components/layouts';
import { PolicySettings } from '@/components/policy/policy-settings';
import { Card, DocsLink, DocsNote, Heading, Title } from '@/components/v2';
import { graphql } from '@/gql';
import { withSessionProtection } from '@/lib/supertokens/guard';

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
        ...ProjectLayout_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      id
      ...ProjectLayout_ProjectFragment
      schemaPolicy {
        id
        updatedAt
        ...PolicySettings_SchemaPolicyFragment
      }
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
          ...ProjectLayout_ProjectFragment
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

function ProjectPolicyPage(): ReactElement {
  const [mutation, mutate] = useMutation(UpdateSchemaPolicyForProject);

  return (
    <>
      <Title title="Project Schema Policy" />
      <ProjectLayout
        value="policy"
        className="flex flex-col gap-y-10"
        query={ProjectPolicyPageQuery}
      >
        {(props, selector) =>
          props.project && props.organization ? (
            <Card>
              <Heading className="mb-2">Project Schema Policy</Heading>
              <DocsNote>
                <strong>Schema Policies</strong> enable developers to define additional semantic
                checks on the GraphQL schema. At the project level, policies can be defined to
                affect all targets, and override policy configuration defined at the organization
                level. <DocsLink href="/features/schema-policy">Learn more</DocsLink>
              </DocsNote>
              {props.organization.organization.schemaPolicy?.allowOverrides ? (
                <PolicySettings
                  saving={mutation.fetching}
                  rulesInParent={props.organization.organization.schemaPolicy?.rules.map(
                    r => r.rule.id,
                  )}
                  error={
                    mutation.error?.message ||
                    mutation.data?.updateSchemaPolicyForProject.error?.message
                  }
                  onSave={async newPolicy => {
                    await mutate({
                      selector,
                      policy: newPolicy,
                    });
                  }}
                  currentState={props.project.schemaPolicy}
                />
              ) : (
                <div className="mt-4 text-gray-400 pl-1 text-sm font-bold">
                  <p className="text-orange-500 inline-block mr-4">!</p>
                  Organization settings does not allow projects to override policy. Please consult
                  your organization administrator.
                </div>
              )}
            </Card>
          ) : null
        }
      </ProjectLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ProjectPolicyPage);
