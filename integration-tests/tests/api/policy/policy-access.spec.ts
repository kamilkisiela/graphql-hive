import { ProjectType } from '@app/gql/graphql';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

describe('Policy Access', () => {
  describe('Target', () => {
    const query = graphql(`
      query TargetSchemaPolicyAccess($selector: TargetSelectorInput!) {
        target(selector: $selector) {
          schemaPolicy {
            mergedRules {
              severity
            }
          }
        }
      }
    `);

    test.concurrent(
      'should successfully fetch Target.schemaPolicy if the user has access to SETTINGS',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { organization, createProject, inviteAndJoinMember } = await createOrg();
        const { project, target } = await createProject(ProjectType.Single);
        const adminRole = organization.memberRoles.find(r => r.name === 'Admin');

        if (!adminRole) {
          throw new Error('Admin role not found');
        }

        const { member, memberToken, assignMemberRole } = await inviteAndJoinMember();
        await assignMemberRole({
          roleId: adminRole.id,
          memberId: member.id,
        });

        const result = await execute({
          document: query,
          variables: {
            selector: {
              organization: organization.cleanId,
              project: project.cleanId,
              target: target.cleanId,
            },
          },
          authToken: memberToken,
        }).then(r => r.expectNoGraphQLErrors());

        expect(result.target?.schemaPolicy?.mergedRules).not.toBeNull();
      },
    );

    test.concurrent(
      'should fail to fetch Target.schemaPolicy if the user lacks access to SETTINGS',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { organization, createProject, inviteAndJoinMember } = await createOrg();
        const { project, target } = await createProject(ProjectType.Single);
        const { memberToken } = await inviteAndJoinMember();

        await execute({
          document: query,
          variables: {
            selector: {
              organization: organization.cleanId,
              project: project.cleanId,
              target: target.cleanId,
            },
          },
          authToken: memberToken,
        }).then(r => r.expectGraphQLErrors());
      },
    );
  });

  describe('Project', () => {
    const query = graphql(`
      query ProjectSchemaPolicyAccess($selector: ProjectSelectorInput!) {
        project(selector: $selector) {
          schemaPolicy {
            id
          }
        }
      }
    `);

    test.concurrent(
      'should successfully fetch Project.schemaPolicy if the user has access to SETTINGS',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { organization, createProject, inviteAndJoinMember } = await createOrg();
        const { project } = await createProject(ProjectType.Single);
        const adminRole = organization.memberRoles.find(r => r.name === 'Admin');

        if (!adminRole) {
          throw new Error('Admin role not found');
        }

        const { member, memberToken, assignMemberRole } = await inviteAndJoinMember();
        await assignMemberRole({
          roleId: adminRole.id,
          memberId: member.id,
        });

        const result = await execute({
          document: query,
          variables: {
            selector: {
              organization: organization.cleanId,
              project: project.cleanId,
            },
          },
          authToken: memberToken,
        }).then(r => r.expectNoGraphQLErrors());

        expect(result.project?.schemaPolicy?.id).not.toBeNull();
      },
    );

    test.concurrent(
      'should fail to fetch Project.schemaPolicy if the user lacks access to SETTINGS',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { organization, createProject, inviteAndJoinMember } = await createOrg();
        const { project, target } = await createProject(ProjectType.Single);
        const { memberToken } = await inviteAndJoinMember();

        await execute({
          document: query,
          variables: {
            selector: {
              organization: organization.cleanId,
              project: project.cleanId,
            },
          },
          authToken: memberToken,
        }).then(r => r.expectGraphQLErrors());
      },
    );
  });

  describe('Organization', () => {
    const query = graphql(`
      query OrganizationSchemaPolicyAccess($selector: OrganizationSelectorInput!) {
        organization(selector: $selector) {
          organization {
            schemaPolicy {
              id
            }
          }
        }
      }
    `);
    test.concurrent(
      'should successfully fetch Organization.schemaPolicy if the user has access to SETTINGS',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { organization, inviteAndJoinMember } = await createOrg();
        const adminRole = organization.memberRoles.find(r => r.name === 'Admin');

        if (!adminRole) {
          throw new Error('Admin role not found');
        }

        const { member, memberToken, assignMemberRole } = await inviteAndJoinMember();
        await assignMemberRole({
          roleId: adminRole.id,
          memberId: member.id,
        });

        const result = await execute({
          document: query,
          variables: {
            selector: {
              organization: organization.cleanId,
            },
          },
          authToken: memberToken,
        }).then(r => r.expectNoGraphQLErrors());

        expect(result.organization?.organization.schemaPolicy?.id).not.toBeNull();
      },
    );

    test.concurrent(
      'should fail to fetch Organization.schemaPolicy if the user lacks access to SETTINGS',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { organization, inviteAndJoinMember } = await createOrg();
        const { memberToken } = await inviteAndJoinMember();

        await execute({
          document: query,
          variables: {
            selector: {
              organization: organization.cleanId,
            },
          },
          authToken: memberToken,
        }).then(r => r.expectGraphQLErrors());
      },
    );
  });
});
